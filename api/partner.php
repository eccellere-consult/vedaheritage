<?php
// Partner portal API: a stay or transport partner signs in with an emailed link (no password) and manages its own rides, bookings,
// rooms and vehicles. One endpoint: /api/partner.php?a=<action>. Sessions are stored hashed in the private data folder.
define('VH_LIB', 1);
require __DIR__ . '/lib/accounts.php';

$a = preg_replace('/[^a-z_]/', '', $_GET['a'] ?? '');
$post = ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST';
$in = $post ? (json_decode((string)file_get_contents('php://input'), true) ?: []) : [];
$err = fn(string $m, int $c = 422) => public_out($c, ['ok' => false, 'error' => $m]);
$portalOpen = fn() => bk_open('enquiries') || bk_open('stays') || bk_open('rides') || bk_open('kyc');
function partner_dir(string $sub): string { return bk_dir('partner/' . $sub); }

// ---- sign in: ask for an emailed link. Always answers the same, so nobody can discover which emails are partners.
if ($a === 'login' && $post) {
    if (!rate_ok('booking-partner-login', 5, 3600)) $err('Too many attempts. Please try again later.', 429);
    $email = strtolower(trim((string)($in['email'] ?? '')));
    if (valid_email($email) && $portalOpen()) {
        foreach (bk_providers() as $p) if (strtolower($p['email'] ?? '') === $email && bk_partner_base($p)) {
            [$t, $h] = bk_token_new();
            save_json(partner_dir('logins') . "/$h.json", ['providerId' => $p['id'], 'expires' => time() + 1200]);
            bk_mail($email, 'Your Veda Heritage partner sign-in link', "Hello,\n\nOpen this link to sign in to the partner page. It works once and expires in 20 minutes:\n\n" . site_base() . "/partner/#t=$t\n\nIf you did not ask for this, ignore this email.\n\nVeda Heritage");
            break;
        }
    }
    public_out(200, ['ok' => true, 'message' => 'If that email belongs to a partner, a sign-in link is on its way.']);
}
// ---- exchange the emailed link for a session
if ($a === 'session' && $post) {
    if (!rate_ok('booking-partner-login', 20, 3600)) $err('Too many attempts. Please try again later.', 429);
    $h = hash('sha256', (string)($in['token'] ?? '')); $f = partner_dir('logins') . "/$h.json"; $l = json_file($f);
    if (!$l || ($l['expires'] ?? 0) < time()) $err('This sign-in link has expired or was already used. Ask for a new one.', 401);
    @unlink($f);
    [$t, $sh] = bk_token_new();
    save_json(partner_dir('sessions') . "/$sh.json", ['providerId' => $l['providerId'], 'expires' => time() + 14 * 86400]);
    public_out(200, ['ok' => true, 'session' => $t]);
}

// ---- everything below needs a session
$tok = (string)($_SERVER['HTTP_X_PARTNER_TOKEN'] ?? '');
$sf = $tok !== '' ? partner_dir('sessions') . '/' . hash('sha256', $tok) . '.json' : '';
$sess = $sf ? json_file($sf) : null;
if (!$sess || ($sess['expires'] ?? 0) < time()) $err('Please sign in again.', 401);
if (!rate_ok('booking-partner-api', 600, 3600)) $err('Too many requests. Please wait a little.', 429);
$pid = $sess['providerId']; $ppath = market_dir('providers') . "/$pid.json"; $p = json_file($ppath);
if (!$p || !bk_partner_base($p)) $err('Your partner account is not active. Contact Veda Heritage.', 403);
if (!$portalOpen()) $err('The partner page is not open yet.', 403);

if ($a === 'logout' && $post) { @unlink($sf); public_out(200, ['ok' => true]); }

$mine = function () use ($pid) { $o = []; foreach (glob(bk_dir('items') . '/*.json') ?: [] as $f) { $b = json_file($f); if ($b && ($b['providerId'] ?? '') === $pid) $o[] = $b; } usort($o, fn($x, $y) => strcmp($y['created'], $x['created'])); return $o; };

// ---- verification: the partner uploads its documents and location; the admin reviews them
$kycOn = bk_open('kyc');
$verifView = function (array $p) { $v = $p['verification'] ?? []; $docs = []; foreach (($v['docs'] ?? []) as $d) $docs[] = ['docId' => $d['docId'], 'docType' => $d['docType'], 'label' => PROV_DOC_TYPES[$d['docType']] ?? $d['docType'], 'status' => $d['status'], 'expires' => $d['expires'] ?? null, 'note' => $d['note'] ?? '', 'uploadedOn' => $d['uploadedOn'] ?? ''];
    return ['required' => array_map(fn($t) => ['docType' => $t, 'label' => PROV_DOC_TYPES[$t], 'needsExpiry' => in_array($t, PROV_EXPIRY_REQUIRED, true)], PROV_REQUIRED[$p['type']] ?? []), 'optional' => $p['type'] === 'stay' ? ['property_photo'] : [], 'docs' => $docs, 'geo' => $v['geo'] ?? null, 'state' => prov_verification($p), 'docLabels' => PROV_DOC_TYPES]; };
if ($a === 'verification') public_out(200, ['ok' => true, 'kycOpen' => $kycOn, 'vaultReady' => vault_ready()] + $verifView($p));
if (in_array($a, ['vdoc_upload', 'vdoc_delete', 'geo_save', 'formc_list', 'formc_view', 'formc_doc', 'formc_filed'], true) && !$kycOn) $err('Identity verification is not open yet.', 403);
if ($a === 'vdoc_upload' && $post) {
    $dt = (string)($in['docType'] ?? ''); $allowed = array_merge(PROV_REQUIRED[$p['type']] ?? [], $p['type'] === 'stay' ? ['property_photo'] : []);
    if (!in_array($dt, $allowed, true)) $err('Choose a document type that applies to you.');
    $bytes = base64_decode((string)($in['data'] ?? ''), true); if ($bytes === false) $err('That file could not be read.');
    $m = vault_put($bytes, ['type' => 'provider', 'id' => $pid], $dt, null); if (is_string($m)) $err($m);
    $docs = []; foreach (($p['verification']['docs'] ?? []) as $d) { if ($d['docType'] === $dt) vault_delete($d['docId']); else $docs[] = $d; }   // a new upload replaces the old one
    $docs[] = ['docId' => $m['id'], 'docType' => $dt, 'status' => 'pending', 'expires' => null, 'note' => '', 'uploadedOn' => gmdate('Y-m-d')];
    $p['verification']['docs'] = $docs; save_json($ppath, $p); vault_audit('provider:' . $pid, 'doc_uploaded', $m['id']);
    public_out(200, ['ok' => true, 'message' => 'Uploaded and encrypted. We review it and set its expiry date.']);
}
if ($a === 'vdoc_delete' && $post) {
    $docs = []; $hit = false; foreach (($p['verification']['docs'] ?? []) as $d) { if ($d['docId'] === (string)($in['docId'] ?? '')) { vault_delete($d['docId']); $hit = true; } else $docs[] = $d; }
    if (!$hit) $err('Not found.', 404); $p['verification']['docs'] = $docs; save_json($ppath, $p); public_out(200, ['ok' => true, 'message' => 'Deleted.']);
}
if ($a === 'geo_save' && $post) {
    $lat = $in['lat'] ?? null; $lng = $in['lng'] ?? null;
    if (!is_numeric($lat) || !is_numeric($lng)) $err('Give the latitude and longitude, or use your device location.');
    if ($lat < KERALA_BOUNDS['lat'][0] || $lat > KERALA_BOUNDS['lat'][1] || $lng < KERALA_BOUNDS['lng'][0] || $lng > KERALA_BOUNDS['lng'][1]) $err('That location is outside Kerala.');
    $p['verification']['geo'] = ['lat' => round((float)$lat, 6), 'lng' => round((float)$lng, 6), 'source' => ($in['source'] ?? '') === 'device' ? 'device' : 'typed', 'setOn' => gmdate('c'), 'status' => 'pending', 'note' => ''];
    save_json($ppath, $p); public_out(200, ['ok' => true, 'message' => 'Location saved. We check it against your address.']);
}

// ---- Form C assist (stays only): the guest details a host needs to file Form C. The host files it; this page only shows the data, and every view is logged.
if ($p['type'] === 'stay' && in_array($a, ['formc_list', 'formc_view', 'formc_doc', 'formc_filed'], true)) {
    $today = gmdate('Y-m-d'); kyc_purge_all();
    $eligible = function (array $b) use ($pid, $today) { return ($b['providerId'] ?? '') === $pid && ($b['kind'] ?? '') === 'stay' && in_array($b['status'], ['confirmed', 'paid'], true) && !empty($b['accountId']) && ($b['checkIn'] ?? '') <= gmdate('Y-m-d', strtotime($today) + 3 * 86400) && ($b['checkOut'] ?? '') >= gmdate('Y-m-d', strtotime($today) - 7 * 86400); };
    if ($a === 'formc_list') {
        $o = []; foreach ($mine() as $b) { if (($b['kind'] ?? '') !== 'stay' || !in_array($b['status'], ['confirmed', 'paid', 'completed'], true)) continue;
            $ac = !empty($b['accountId']) ? acct_load($b['accountId']) : null; $foreign = $ac && ($ac['residency'] ?? '') === 'foreign';
            $o[] = ['id' => $b['id'], 'ref' => $b['ref'], 'checkIn' => $b['checkIn'], 'checkOut' => $b['checkOut'], 'guest' => $ac ? ($ac['name'] ?? '') : ($b['name'] ?? ''), 'hasAccount' => (bool)$ac, 'foreign' => $foreign, 'identityOn' => $ac['identityOn'] ?? null,
                'available' => $eligible($b) && $foreign && !empty($ac['identityEnc']), 'filed' => $b['formC'] ?? null, 'reason' => !$ac ? 'The guest booked without an account. Ask them to register and add their details.' : (!$foreign ? 'Indian resident: record their ID at check-in as usual.' : (empty($ac['identityEnc']) ? 'The guest has not added their passport and visa details yet.' : (!$eligible($b) ? 'Details open 3 days before check-in and for 7 days after check-out.' : '')))]; }
        public_out(200, ['ok' => true, 'guests' => array_slice($o, 0, 100), 'note' => 'Form C is filed by you, as the host, on the Foreigners Regional Registration Office (FRRO) website, usually within 24 hours of arrival. Check the current rules there.']);
    }
    $bk = bk_load((string)($in['id'] ?? '')); if (!$bk || !$eligible($bk)) $err('These details are not available for this booking.', 403);
    $ac = acct_load($bk['accountId']); if (!$ac || ($ac['residency'] ?? '') !== 'foreign') $err('Form C applies to foreign guests only.', 403); if (empty($ac['identityEnc'])) $err('The guest has not added their details yet.', 404);
    if ($a === 'formc_view' && $post) {
        $idn = acct_identity($ac); if (!$idn) $err('The details could not be opened.', 500); vault_audit('provider:' . $pid, 'formc_view', $bk['ref'], 'Form C');
        $docs = array_map(fn($m) => ['id' => $m['id'], 'label' => ACCT_DOC_TYPES[$m['docType']] ?? $m['docType']], vault_owned('account', $ac['id']));
        public_out(200, ['ok' => true, 'identity' => $idn, 'docs' => $docs, 'phone' => $ac['phone'] ?? '', 'email' => $ac['email']]);
    }
    if ($a === 'formc_doc' && $post) {
        $m = vault_meta((string)($in['docId'] ?? '')); if (!$m || ($m['owner']['id'] ?? '') !== $ac['id']) $err('Not found.', 404);
        $d = vault_get($m['id']); if (!$d) $err('Could not open the file.', 500); vault_audit('provider:' . $pid, 'formc_doc', $bk['ref'] . ':' . $m['id'], 'Form C');
        public_out(200, ['ok' => true, 'mime' => $m['mime'], 'data' => base64_encode($d['bytes'])]);
    }
    if ($a === 'formc_filed' && $post) {
        $ack = clean_text($in['ack'] ?? '', 40); if (mb_strlen($ack) < 3) $err('Enter the acknowledgement or reference number FRRO gave you.');
        bk_locked($bk['id'], function ($x) use ($ack) { $x['formC'] = ['filedOn' => gmdate('c'), 'ack' => $ack]; return $x; }); vault_audit('provider:' . $pid, 'formc_filed', $bk['ref']);
        public_out(200, ['ok' => true, 'message' => 'Recorded.']);
    }
}

if ($a === 'me') {
    public_out(200, ['ok' => true, 'testMode' => bk_test(), 'partner' => ['name' => $p['name'], 'type' => $p['type'], 'typeLabel' => PROVIDER_TYPES[$p['type']][0] ?? $p['type'], 'districts' => $p['districts']],
        'inventory' => ['rooms' => $p['inventory']['rooms'] ?? [], 'blocked' => (object)($p['inventory']['blocked'] ?? []), 'vehicles' => $p['inventory']['vehicles'] ?? []], 'vehicles' => RIDE_VEHICLES, 'payoutAccountSet' => !empty($p['inventory']['razorpayAccountId']),
        'caps' => ['stays' => bk_open('stays'), 'rides' => bk_open('rides'), 'enquiries' => bk_open('enquiries')]]);
}
if ($a === 'overview') {
    $open = []; $rides = []; $stays = [];
    foreach (glob(bk_dir('items') . '/*.json') ?: [] as $f) {
        $b = json_file($f); if (!$b) continue;
        if (($b['kind'] ?? '') === 'ride' && ($b['status'] ?? '') === 'searching' && array_filter($b['dispatch'] ?? [], fn($d) => ($d['providerId'] ?? '') === $pid)) $open[] = ride_view($b, $pid);
    }
    foreach ($mine() as $b) {
        $pay = $b['payment'] ?? null;
        $row = ['id' => $b['id'], 'ref' => $b['ref'], 'kind' => $b['kind'] ?? 'enquiry', 'status' => $b['status'], 'test' => !empty($b['test']), 'created' => $b['created'], 'checkIn' => $b['checkIn'] ?? '', 'checkOut' => $b['checkOut'] ?? '', 'people' => $b['people'] ?? 0,
            'name' => $b['name'] ?? '', 'phone' => $b['contactPhone'] ?? '', 'email' => $b['contactEmail'] ?? '', 'message' => $b['message'] ?? '', 'roomName' => $b['roomName'] ?? '', 'amountInr' => $b['amountInr'] ?? ($b['valueInr'] ?? null),
            'paid' => ($pay['status'] ?? '') === 'paid', 'online' => ($pay['mode'] ?? '') === 'online', 'payoutHeld' => !empty($pay['payoutHeld']), 'partnerShareInr' => $b['partnerShareInr'] ?? null, 'feeInr' => $b['feeInr'] ?? null, 'gstInr' => $b['gstInr'] ?? null];
        if (($b['kind'] ?? '') === 'ride') $rides[] = ride_view($b, $pid) + ['partnerShareInr' => $row['partnerShareInr'], 'paid' => $row['paid'], 'payoutHeld' => $row['payoutHeld'], 'rideName' => $b['name'] ?? '', 'ridePhone' => $b['contactPhone'] ?? ''];
        else $stays[] = $row;
    }
    public_out(200, ['ok' => true, 'openRides' => $open, 'rides' => array_slice($rides, 0, 60), 'bookings' => array_slice($stays, 0, 100)]);
}
if ($a === 'claim' && $post) {
    $id = (string)($in['id'] ?? ''); $b = bk_load($id);
    if (!$b || ($b['kind'] ?? '') !== 'ride' || !array_filter($b['dispatch'] ?? [], fn($d) => ($d['providerId'] ?? '') === $pid)) $err('This ride is not available to you.', 404);
    [$x, $e] = ride_claim_do($id, $p, (string)($in['driverName'] ?? ''), (string)($in['driverPhone'] ?? ''), (string)($in['vehicleNo'] ?? ''));
    if (!$x) $err($e, strpos($e, 'already') !== false ? 409 : 422);
    public_out(200, ['ok' => true, 'message' => 'The ride is yours. The traveller was sent your details and a trip code.']);
}
if ($a === 'trip' && $post) {
    [$ok, $m] = ride_trip_do((string)($in['id'] ?? ''), $pid, (string)($in['action'] ?? ''), (string)($in['otp'] ?? ''));
    if (!$ok) $err($m); public_out(200, ['ok' => true, 'message' => $m]);
}
if ($a === 'respond' && $post) {
    $id = (string)($in['id'] ?? ''); $dec = (string)($in['decision'] ?? ''); $b = bk_load($id);
    if (!$b || ($b['providerId'] ?? '') !== $pid || ($b['kind'] ?? '') === 'ride' || !in_array($dec, ['confirm', 'decline'], true)) $err('Not found.', 404);
    if (($b['payment']['mode'] ?? '') === 'online' || !in_array($b['status'], ['new', 'sent'], true)) $err('This booking cannot be changed here. Contact Veda Heritage.');
    bk_locked($id, function ($x) use ($dec) { $x['status'] = $dec === 'confirm' ? 'confirmed' : 'declined'; $x['respondedOn'] = gmdate('c'); if ($dec === 'decline') foreach (['contactEmail', 'contactPhone', 'message'] as $k) $x[$k] = ''; return $x; });
    notify('Partner ' . ($dec === 'confirm' ? 'confirmed' : 'declined') . ' ' . $b['ref'], $p['name'] . ' ' . $dec . 'ed booking request ' . $b['ref'] . '.');
    public_out(200, ['ok' => true, 'message' => $dec === 'confirm' ? 'Confirmed. Please contact the traveller to finalise.' : 'Declined.']);
}
if ($a === 'inventory_save' && $post) {
    [$inv, $e] = bk_inventory_apply($p, $in, false); if ($e) $err($e, 400);
    $p['inventory'] = $inv; save_json($ppath, $p); public_out(200, ['ok' => true, 'message' => 'Saved. New bookings use these rates and dates.']);
}
$err('Unknown action.', 404);
