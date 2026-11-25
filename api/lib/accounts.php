<?php
// Traveller accounts: register and sign in by emailed link, profile, identity details, documents, saved itineraries, dashboard.
if (!defined('VH_LIB')) define('VH_LIB', 1);
require_once __DIR__ . '/commerce.php';
require_once __DIR__ . '/vault.php';

const ACCT_DOC_TYPES = ['passport_photo' => 'Passport photo page', 'passport_address' => 'Passport address page', 'visa' => 'Indian visa', 'id_front' => 'ID card front', 'id_back' => 'ID card back'];
const ACCT_ID_TYPES = ['Passport', 'Driving licence', 'Voter ID', 'PAN card', 'Other government ID'];
const ACCT_MAX_DOCS = 8; const ACCT_MAX_TRIPS = 10;

function acct_dir(string $sub = ''): string { $d = vh_data_dir() . '/accounts' . ($sub !== '' ? "/$sub" : ''); if (!is_dir($d)) @mkdir($d, 0700, true); return $d; }
function acct_load(string $id): ?array { return valid_id($id) ? json_file(acct_dir('items') . "/$id.json") : null; }
function acct_save(array $a): void { save_json(acct_dir('items') . '/' . $a['id'] . '.json', $a); }
function acct_find(string $email): ?array { $email = strtolower(trim($email)); foreach (glob(acct_dir('items') . '/*.json') ?: [] as $f) { $a = json_file($f); if ($a && strtolower($a['email'] ?? '') === $email) return $a; } return null; }
function acct_all(): array { $o = []; foreach (glob(acct_dir('items') . '/*.json') ?: [] as $f) { $a = json_file($f); if ($a) $o[] = $a; } return $o; }
function acct_open(): bool { return bk_open('accounts'); }

/** Account for the session token in the X-Account-Token header (or $token), or null. */
function acct_session(?string $token = null): ?array {
    $t = $token ?? (string)($_SERVER['HTTP_X_ACCOUNT_TOKEN'] ?? ''); if ($t === '') return null;
    $s = json_file(acct_dir('sessions') . '/' . hash('sha256', $t) . '.json');
    if (!$s || ($s['expires'] ?? 0) < time()) return null;
    $a = acct_load($s['accountId']); return $a && !empty($a['verified']) ? $a : null;
}
function acct_login_link(array $a): void {
    [$t, $h] = bk_token_new(); save_json(acct_dir('logins') . "/$h.json", ['accountId' => $a['id'], 'expires' => time() + 1200]);
    bk_mail($a['email'], 'Your Veda Heritage sign-in link', "Hello" . (!empty($a['name']) ? ' ' . $a['name'] : '') . ",\n\nOpen this link to sign in. It works once and expires in 20 minutes:\n\n" . site_base() . "/account/#t=$t\n\nIf you did not ask for this, ignore this email.\n\nVeda Heritage");
}

/** Bookings that belong to an account: linked at booking time, or made with the account's verified email while the contact is still on file. */
function acct_bookings(array $a): array {
    $o = []; $em = strtolower($a['email']);
    foreach (glob(bk_dir('items') . '/*.json') ?: [] as $f) { $b = json_file($f); if (!$b) continue;
        if (($b['accountId'] ?? '') === $a['id'] || (empty($b['accountId']) && strtolower($b['contactEmail'] ?? '') === $em)) $o[] = $b; }
    usort($o, fn($x, $y) => strcmp($y['created'], $x['created'])); return $o;
}
/** One booking as the traveller sees it: status steps, payment, and the people to contact. */
function acct_booking_view(array $b): array {
    $kind = $b['kind'] ?? 'enquiry'; $pay = $b['payment'] ?? []; $st = $b['status']; $online = ($pay['mode'] ?? '') === 'online';
    $steps = $kind === 'ride'
        ? [['Requested', true], [$online ? 'Paid' : 'Driver search', in_array($st, ['paid', 'searching', 'assigned', 'started', 'completed'], true)], ['Driver assigned', in_array($st, ['assigned', 'started', 'completed'], true)], ['Trip started', in_array($st, ['started', 'completed'], true)], ['Completed', $st === 'completed']]
        : [['Requested', true], ['Sent to the stay', in_array($st, ['sent', 'confirmed', 'completed'], true) || ($online && $st !== 'pay_pending')], ['Confirmed', in_array($st, ['confirmed', 'completed'], true)], $online ? ['Paid', ($pay['status'] ?? '') === 'paid' || ($pay['status'] ?? '') === 'refunded'] : ['Pay on arrival', in_array($st, ['confirmed', 'completed'], true)], ['Completed', $st === 'completed']];
    $contact = null; $p = !empty($b['providerId']) ? json_file(market_dir('providers') . '/' . $b['providerId'] . '.json') : null;
    if ($kind === 'ride' && !empty($b['driver']) && in_array($st, ['assigned', 'started'], true)) $contact = ['label' => 'Your driver', 'name' => $b['driver']['name'], 'phone' => $b['driver']['phone'], 'extra' => 'Vehicle ' . $b['driver']['vehicleNo'] . (!empty($b['otp']) ? '. Trip code ' . $b['otp'] : '')];
    elseif ($p && in_array($st, ['confirmed', 'paid', 'completed', 'sent'], true)) $contact = ['label' => $kind === 'stay' || ($p['type'] ?? '') === 'stay' ? 'Your stay' : 'Your partner', 'name' => $p['name'], 'phone' => $p['phone'] ?? '', 'extra' => ''];
    return ['id' => $b['id'], 'ref' => $b['ref'], 'kind' => $kind, 'status' => $st, 'test' => !empty($b['test']), 'created' => $b['created'], 'partner' => $b['providerName'] ?? '', 'checkIn' => $b['checkIn'] ?? '', 'checkOut' => $b['checkOut'] ?? '', 'people' => $b['people'] ?? 0,
        'room' => $b['roomName'] ?? '', 'pickup' => isset($b['pickupId']) ? (RIDE_POINTS[$b['pickupId']][0] ?? '') : '', 'drop' => isset($b['dropId']) ? (RIDE_POINTS[$b['dropId']][0] ?? '') : '', 'when' => $b['when'] ?? '', 'steps' => $steps, 'contact' => $contact,
        'payment' => ['mode' => $pay['mode'] ?? 'onsite', 'status' => $pay['status'] ?? 'onsite', 'amountInr' => $b['amountInr'] ?? ($b['valueInr'] ?? null), 'paidOn' => $pay['paidOn'] ?? null, 'receipt' => $pay['paymentId'] ?? null, 'refundedInr' => $pay['refundedInr'] ?? 0]];
}

// ---- identity details (sealed). Foreign nationals: the data a stay needs for Form C. Indian residents: a government ID.
function acct_identity_clean(string $residency, array $in) {
    $s = fn($k, $m = 120) => clean_text($in[$k] ?? '', $m); $d = fn($v) => (bool)preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$v) && strtotime((string)$v) !== false; $today = gmdate('Y-m-d');
    if ($residency === 'foreign') {
        $o = ['fullName' => $s('fullName', 80), 'dob' => $s('dob', 10), 'nationality' => $s('nationality', 60), 'passportNo' => strtoupper($s('passportNo', 20)), 'passportIssuePlace' => $s('passportIssuePlace', 60), 'passportIssueDate' => $s('passportIssueDate', 10), 'passportExpiry' => $s('passportExpiry', 10),
            'visaNo' => $s('visaNo', 30), 'visaType' => $s('visaType', 30), 'visaIssueDate' => $s('visaIssueDate', 10), 'visaExpiry' => $s('visaExpiry', 10), 'arrivalDate' => $s('arrivalDate', 10), 'arrivedFrom' => $s('arrivedFrom', 60), 'purpose' => $s('purpose', 60), 'nextDestination' => $s('nextDestination', 60), 'addressAbroad' => $s('addressAbroad', 160)];
        foreach (['fullName', 'dob', 'nationality', 'passportNo', 'passportIssueDate', 'passportExpiry', 'visaNo', 'visaType', 'visaExpiry', 'arrivalDate', 'arrivedFrom', 'purpose', 'addressAbroad'] as $k) if ($o[$k] === '') return "Please fill in: $k.";
        foreach (['dob', 'passportIssueDate', 'passportExpiry', 'visaExpiry', 'arrivalDate'] as $k) if (!$d($o[$k])) return "Please give $k as YYYY-MM-DD.";
        foreach (['visaIssueDate'] as $k) if ($o[$k] !== '' && !$d($o[$k])) return "Please give $k as YYYY-MM-DD.";
        if ($o['dob'] >= $today) return 'The date of birth must be in the past.';
        if ($o['passportExpiry'] < $today) return 'Your passport has expired.';
        if ($o['visaExpiry'] < $today) return 'Your visa has expired.';
        if (!preg_match('/^[A-Z0-9]{5,20}$/', $o['passportNo'])) return 'The passport number should be letters and digits only.';
        return $o;
    }
    $o = ['fullName' => $s('fullName', 80), 'dob' => $s('dob', 10), 'idType' => $s('idType', 30), 'idNumber' => strtoupper($s('idNumber', 30)), 'address' => $s('address', 200), 'purpose' => $s('purpose', 60)];
    if ($o['fullName'] === '' || !$d($o['dob']) || $o['dob'] >= $today || $o['address'] === '') return 'Please give your full name, date of birth (YYYY-MM-DD) and address.';
    if (preg_match('/aadhaar|aadhar|uidai/i', $o['idType'] . ' ' . $o['idNumber']) || preg_match('/^\d{4}\s?\d{4}\s?\d{4}$/', $o['idNumber'])) return 'We do not store Aadhaar numbers or images. Please use another ID.';
    if (!in_array($o['idType'], ACCT_ID_TYPES, true) || !preg_match('/^[A-Z0-9 \/-]{5,30}$/', $o['idNumber'])) return 'Choose an ID type and give its number.';
    return $o;
}
/** Identity as shown to someone who is not the owner (a host filing Form C, or an admin): only after audit logging by the caller. */
function acct_identity(array $a): ?array { return !empty($a['identityEnc']) ? vault_open_json($a['identityEnc']) : null; }

function acct_purge_test(): int {
    $n = 0; foreach (acct_all() as $a) if (!empty($a['identityTest'])) { unset($a['identityEnc'], $a['identityTest'], $a['identityOn']); acct_save($a); $n++; } return $n;
}
function acct_erase(array $a): void {
    vault_delete_owned('account', $a['id']);
    foreach (glob(acct_dir('trips') . '/*.json') ?: [] as $f) { $t = json_file($f); if ($t && ($t['accountId'] ?? '') === $a['id']) @unlink($f); }
    foreach (glob(bk_dir('items') . '/*.json') ?: [] as $f) { $b = json_file($f); if ($b && ($b['accountId'] ?? '') === $a['id']) { unset($b['accountId']); save_json($f, $b); } }
    @unlink(acct_dir('items') . '/' . $a['id'] . '.json');
    foreach (glob(acct_dir('sessions') . '/*.json') ?: [] as $f) { $s = json_file($f); if ($s && ($s['accountId'] ?? '') === $a['id']) @unlink($f); }
}
function acct_emergency(): array {
    $o = [['label' => 'Police, fire, ambulance (all India)', 'phone' => '112'], ['label' => 'Ambulance', 'phone' => '108']];
    $c = (string)(vh_cfg()['contact_phone'] ?? ''); if ($c !== '') $o[] = ['label' => 'Veda Heritage', 'phone' => $c];
    return $o;
}

/** Deletes expired documents, and identity details older than the retention period. Called lazily. */
function kyc_purge_all(): array {
    $d = vault_purge(); $days = (int)(bk_config()['kycRetentionDays'] ?? 180); $cut = gmdate('c', time() - $days * 86400); $i = 0;
    foreach (acct_all() as $a) if (!empty($a['identityEnc']) && !empty($a['identityOn']) && $a['identityOn'] < $cut) { unset($a['identityEnc'], $a['identityOn'], $a['identityTest']); acct_save($a); $i++; }
    return ['docs' => $d, 'identities' => $i];
}
