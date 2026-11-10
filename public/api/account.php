<?php
// Traveller account API. Passwordless: an emailed link signs in (and verifies the email the first time). One endpoint: /api/account.php?a=<action>.
// Locked until "Traveller accounts" is switched on; identity details and documents also need "Identity documents".
define('VH_LIB', 1);
require __DIR__ . '/lib/accounts.php';

$a = preg_replace('/[^a-z_]/', '', $_GET['a'] ?? '');
$post = ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST';
$raw = $post ? (string)file_get_contents('php://input') : '';
if (strlen($raw) > 8 * 1024 * 1024) public_out(413, ['ok' => false, 'error' => 'That upload is too large.']);
$in = $raw !== '' ? (json_decode($raw, true) ?: []) : [];
$err = fn(string $m, int $c = 422) => public_out($c, ['ok' => false, 'error' => $m]);
if (!acct_open()) $err('Accounts are not open yet.', 403);

if ($a === 'register' && $post) {
    if (!rate_ok('booking-acct-reg', 5, 3600)) $err('Too many attempts. Please try again later.', 429);
    $email = strtolower(trim((string)($in['email'] ?? ''))); $name = clean_text($in['name'] ?? '', 60); $phone = trim((string)($in['phone'] ?? ''));
    $country = clean_text($in['country'] ?? '', 60); $res = ($in['residency'] ?? '') === 'foreign' ? 'foreign' : 'indian';
    if (!valid_email($email)) $err('Please give a valid email address.');
    if ($name === '') $err('Please give your name.');
    if ($phone !== '' && !normalise_phone($phone)) $err('That phone number does not look right.');
    if (empty($in['consent'])) $err('Please tick the box to accept the terms and privacy notice.');
    $ex = acct_find($email);
    if ($ex && !empty($ex['verified'])) acct_login_link($ex);       // already registered: behave like sign-in, say nothing different
    else {
        $acc = $ex ?: ['id' => new_id(), 'created' => gmdate('c'), 'verified' => false, 'email' => $email];
        $acc = array_merge($acc, ['name' => $name, 'phone' => normalise_phone($phone) ?? '', 'country' => $country, 'residency' => $res]);
        $acc['consents'] = array_merge($acc['consents'] ?? [], [['purpose' => 'account', 'version' => CONSENT_VERSION, 'at' => gmdate('c')]]);
        acct_save($acc); acct_login_link($acc);
    }
    public_out(200, ['ok' => true, 'message' => 'Check your email for a sign-in link. It works once and expires in 20 minutes.']);
}
if ($a === 'login' && $post) {
    if (!rate_ok('booking-acct-reg', 8, 3600)) $err('Too many attempts. Please try again later.', 429);
    $ex = acct_find((string)($in['email'] ?? '')); if ($ex && !empty($ex['verified'])) acct_login_link($ex);
    public_out(200, ['ok' => true, 'message' => 'If that email has an account, a sign-in link is on its way.']);
}
if ($a === 'session' && $post) {
    if (!rate_ok('booking-acct-reg', 20, 3600)) $err('Too many attempts. Please try again later.', 429);
    $h = hash('sha256', (string)($in['token'] ?? '')); $f = acct_dir('logins') . "/$h.json"; $l = json_file($f);
    if (!$l || ($l['expires'] ?? 0) < time()) $err('This sign-in link has expired or was already used. Ask for a new one.', 401);
    @unlink($f); $acc = acct_load($l['accountId']); if (!$acc) $err('Account not found.', 404);
    if (empty($acc['verified'])) { $acc['verified'] = true; $acc['verifiedOn'] = gmdate('c'); acct_save($acc); }
    [$t, $sh] = bk_token_new(); save_json(acct_dir('sessions') . "/$sh.json", ['accountId' => $acc['id'], 'expires' => time() + 30 * 86400]);
    public_out(200, ['ok' => true, 'session' => $t]);
}

// ---- everything below needs a session
$acc = acct_session(); if (!$acc) $err('Please sign in again.', 401);
if (!rate_ok('booking-acct-api', 600, 3600)) $err('Too many requests. Please wait a little.', 429);
kyc_purge_all();
$kycOpen = bk_open('kyc'); $id = $acc['id'];
$docsOf = fn() => array_map(fn($m) => ['id' => $m['id'], 'docType' => $m['docType'], 'label' => ACCT_DOC_TYPES[$m['docType']] ?? $m['docType'], 'kind' => $m['kind'], 'size' => $m['size'], 'created' => $m['created'], 'deleteAfter' => $m['deleteAfter']], vault_owned('account', $id));

if ($a === 'logout' && $post) { @unlink(acct_dir('sessions') . '/' . hash('sha256', (string)$_SERVER['HTTP_X_ACCOUNT_TOKEN']) . '.json'); public_out(200, ['ok' => true]); }

if ($a === 'me') {
    $cfg = bk_config();
    public_out(200, ['ok' => true, 'testMode' => bk_test(), 'kycOpen' => $kycOpen, 'vaultReady' => vault_ready(), 'retentionDays' => (int)($cfg['kycRetentionDays'] ?? 180),
        'account' => ['email' => $acc['email'], 'name' => $acc['name'] ?? '', 'phone' => $acc['phone'] ?? '', 'country' => $acc['country'] ?? '', 'residency' => $acc['residency'] ?? 'indian', 'emergencyContact' => $acc['emergencyContact'] ?? null,
            'identityOn' => $acc['identityOn'] ?? null, 'kycConsentOn' => $acc['kycConsentOn'] ?? null], 'docs' => $docsOf(), 'docTypes' => ACCT_DOC_TYPES, 'idTypes' => ACCT_ID_TYPES]);
}
if ($a === 'dashboard') {
    $views = array_map('acct_booking_view', acct_bookings($acc)); $trips = [];
    foreach (glob(acct_dir('trips') . '/*.json') ?: [] as $f) { $t = json_file($f); if ($t && ($t['accountId'] ?? '') === $id) $trips[] = ['id' => $t['id'], 'name' => $t['name'], 'updated' => $t['updated'], 'plan' => $t['plan']]; }
    usort($trips, fn($x, $y) => strcmp($y['updated'], $x['updated']));
    $needId = ($acc['residency'] ?? '') === 'foreign' && empty($acc['identityOn']) && array_filter($views, fn($v) => $v['kind'] === 'stay' && in_array($v['status'], ['confirmed', 'paid', 'new', 'sent', 'pay_pending'], true));
    public_out(200, ['ok' => true, 'bookings' => $views, 'trips' => $trips, 'emergency' => acct_emergency(), 'identityNeeded' => (bool)$needId && $kycOpen,
        'payments' => array_values(array_filter(array_map(fn($v) => ['ref' => $v['ref'], 'kind' => $v['kind'], 'partner' => $v['partner'], 'mode' => $v['payment']['mode'], 'status' => $v['payment']['status'], 'amountInr' => $v['payment']['amountInr'], 'paidOn' => $v['payment']['paidOn'], 'receipt' => $v['payment']['receipt'], 'refundedInr' => $v['payment']['refundedInr']], $views), fn($p) => $p['mode'] === 'online'))]);
}
if ($a === 'profile_save' && $post) {
    $name = clean_text($in['name'] ?? '', 60); $phone = trim((string)($in['phone'] ?? '')); $res = ($in['residency'] ?? '') === 'foreign' ? 'foreign' : 'indian';
    if ($name === '') $err('Please give your name.'); if ($phone !== '' && !normalise_phone($phone)) $err('That phone number does not look right.');
    $ec = $in['emergencyContact'] ?? null; $ecn = is_array($ec) ? clean_text($ec['name'] ?? '', 60) : ''; $ecp = is_array($ec) ? trim((string)($ec['phone'] ?? '')) : '';
    if ($ecp !== '' && !normalise_phone($ecp)) $err('The emergency contact phone number does not look right.');
    $acc['name'] = $name; $acc['phone'] = $phone === '' ? '' : normalise_phone($phone); $acc['country'] = clean_text($in['country'] ?? '', 60); $acc['residency'] = $res;
    $acc['emergencyContact'] = $ecn !== '' && $ecp !== '' ? ['name' => $ecn, 'phone' => normalise_phone($ecp)] : null; acct_save($acc);
    public_out(200, ['ok' => true, 'message' => 'Saved.']);
}
if ($a === 'itinerary_save' && $post) {
    $name = clean_text($in['name'] ?? '', 60) ?: 'My trip'; $plan = $in['plan'] ?? null;
    if (!is_array($plan) || !isset($plan['days']) || !is_array($plan['days']) || strlen(json_encode($plan)) > 20000 || count($plan['days']) > 30) $err('That itinerary could not be saved.');
    $tid = (string)($in['id'] ?? ''); $f = valid_id($tid) ? acct_dir('trips') . "/$tid.json" : ''; $ex = $f ? json_file($f) : null;
    if ($ex && ($ex['accountId'] ?? '') !== $id) $ex = null;
    if (!$ex) { $n = 0; foreach (glob(acct_dir('trips') . '/*.json') ?: [] as $x) { $t = json_file($x); if ($t && ($t['accountId'] ?? '') === $id) $n++; } if ($n >= ACCT_MAX_TRIPS) $err('You can save up to ' . ACCT_MAX_TRIPS . ' itineraries. Delete one first.'); $tid = new_id(); }
    save_json(acct_dir('trips') . "/$tid.json", ['id' => $tid, 'accountId' => $id, 'name' => $name, 'plan' => $plan, 'updated' => gmdate('c')]);
    public_out(200, ['ok' => true, 'id' => $tid, 'message' => 'Saved to your account.']);
}
if ($a === 'itinerary_delete' && $post) { $tid = (string)($in['id'] ?? ''); $t = valid_id($tid) ? json_file(acct_dir('trips') . "/$tid.json") : null; if (!$t || ($t['accountId'] ?? '') !== $id) $err('Not found.', 404); @unlink(acct_dir('trips') . "/$tid.json"); public_out(200, ['ok' => true]); }

// ---- identity and documents
if (in_array($a, ['identity_save', 'identity_get', 'doc_upload', 'doc_get', 'doc_delete'], true)) {
    if (!$kycOpen) $err('Identity documents are not open yet.', 403);
    if (!vault_ready()) $err('Secure storage is not set up yet.', 503);
}
if ($a === 'identity_get') { $d = acct_identity($acc); vault_audit('account:' . $id, 'identity_view_own', $id); public_out(200, ['ok' => true, 'identity' => $d, 'on' => $acc['identityOn'] ?? null]); }
if ($a === 'identity_save' && $post) {
    if (empty($in['consent'])) $err('Please tick the consent box. We need it before we can store your identity details.');
    $res = ($acc['residency'] ?? 'indian'); $c = acct_identity_clean($res, is_array($in['identity'] ?? null) ? $in['identity'] : []); if (is_string($c)) $err($c);
    $sealed = vault_seal_json($c); if ($sealed === null) $err('Secure storage is not set up yet.', 503);
    $acc['identityEnc'] = $sealed; $acc['identityOn'] = gmdate('c'); $acc['identityTest'] = !vault_real_key();
    $acc['kycConsentOn'] = gmdate('c'); $acc['consents'] = array_merge($acc['consents'] ?? [], [['purpose' => 'identity', 'version' => CONSENT_VERSION, 'at' => gmdate('c')]]);
    acct_save($acc); vault_audit('account:' . $id, 'identity_saved', $id);
    public_out(200, ['ok' => true, 'message' => 'Saved, encrypted. Only the stays you book (for their legal guest registration) and our verification team can see it, and every view is logged.']);
}
if ($a === 'doc_upload' && $post) {
    if (empty($acc['kycConsentOn'])) $err('Please save your identity details and consent first.');
    $dt = (string)($in['docType'] ?? ''); if (!isset(ACCT_DOC_TYPES[$dt])) $err('Choose what the document is.');
    if (count(vault_owned('account', $id)) >= ACCT_MAX_DOCS) $err('You can store up to ' . ACCT_MAX_DOCS . ' documents. Delete one first.');
    $bytes = base64_decode((string)($in['data'] ?? ''), true); if ($bytes === false) $err('That file could not be read.');
    $cfg = bk_config(); $del = gmdate('Y-m-d', time() + (int)($cfg['kycRetentionDays'] ?? 180) * 86400);
    $m = vault_put($bytes, ['type' => 'account', 'id' => $id], $dt, $del); if (is_string($m)) $err($m);
    vault_audit('account:' . $id, 'doc_uploaded', $m['id']); public_out(200, ['ok' => true, 'message' => 'Uploaded and encrypted. It is deleted automatically on ' . $del . ' unless you delete it sooner.']);
}
if ($a === 'doc_get') {
    $m = vault_meta((string)($_GET['id'] ?? '')); if (!$m || ($m['owner']['id'] ?? '') !== $id || ($m['owner']['type'] ?? '') !== 'account') $err('Not found.', 404);
    $d = vault_get($m['id']); if (!$d) $err('Could not open the file.', 500); vault_audit('account:' . $id, 'doc_view_own', $m['id']);
    public_out(200, ['ok' => true, 'mime' => $m['mime'], 'data' => base64_encode($d['bytes'])]);
}
if ($a === 'doc_delete' && $post) { $m = vault_meta((string)($in['id'] ?? '')); if (!$m || ($m['owner']['id'] ?? '') !== $id) $err('Not found.', 404); vault_delete($m['id']); vault_audit('account:' . $id, 'doc_deleted', $m['id']); public_out(200, ['ok' => true, 'message' => 'Deleted.']); }
if ($a === 'erase' && $post) {
    if (($in['confirm'] ?? '') !== 'DELETE') $err('Type DELETE to confirm.');
    vault_audit('account:' . $id, 'account_erased', $id); acct_erase($acc); public_out(200, ['ok' => true, 'message' => 'Your account, itineraries and documents were deleted. Bookings stay on record without your name and contact details once they are completed.']);
}
$err('Unknown action.', 404);
