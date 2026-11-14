<?php
// Public: a traveller asks a verified partner for a stay or a ride. Locked until the admin opens "Partner enquiries".
// The request gets a booking reference and waits in the admin; a person sends it to the partner. Payment is on site.
define('VH_LIB', 1);
require __DIR__ . '/lib/bookings.php';
require_once __DIR__ . '/lib/accounts.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') public_out(405, ['ok' => false, 'error' => 'POST only.']);
$err = fn(string $m, int $c = 422) => public_out($c, ['ok' => false, 'error' => $m]);
bk_gate('enquiries', $err);
if (!empty($_POST['website'])) public_out(200, ['ok' => true]); // honeypot

$pid = (string)($_POST['providerId'] ?? '');
$name = clean_text($_POST['name'] ?? '', 60); $msg = clean_text($_POST['message'] ?? '', 1500);
$email = trim((string)($_POST['contactEmail'] ?? '')); $phone = trim((string)($_POST['contactPhone'] ?? ''));
$in = (string)($_POST['checkIn'] ?? ''); $out = (string)($_POST['checkOut'] ?? ''); $people = (int)($_POST['people'] ?? 0);
$okDate = fn($d) => (bool)preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) && strtotime($d) !== false;

$prov = valid_id($pid) ? json_file(market_dir('providers') . "/$pid.json") : null;
if (!$prov || !bk_partner_ok($prov)) $err('This partner cannot take requests right now.', 404);
if ($name === '') $err('Please add your name.');
if ($email === '' && $phone === '') $err('Please give an email address or a phone number.');
if ($email !== '' && !valid_email($email)) $err('That email address does not look right.');
if ($phone !== '' && !($phoneN = normalise_phone($phone))) $err('That phone number does not look right.');
if (!$okDate($in) || !$okDate($out) || $out < $in || $in < gmdate('Y-m-d', time() - 86400) || (strtotime($out) - strtotime($in)) / 86400 > 90) $err('Please choose valid dates (the end on or after the start, within 90 days, not in the past).');
if ($people < 1 || $people > 30) $err('Please say how many people (1 to 30).');
if (has_link($msg)) $err('Please leave web links out of your message.');
if (empty($_POST['consent'])) $err('Please tick the confirmation that we may share these details with the partner.');
if (!rate_ok('booking-hour', 4, 3600) || !rate_ok('booking-day', 12, 86400)) $err('Too many requests. Please try again later.', 429);

$id = new_id(); $ref = bk_ref();
save_json(bk_dir('items') . "/$id.json", [
    'id' => $id, 'ref' => $ref, 'status' => 'new', 'created' => gmdate('c'),
    'providerId' => $pid, 'providerName' => $prov['name'], 'providerType' => $prov['type'], 'districts' => $prov['districts'],
    'name' => $name, 'contactEmail' => strtolower($email), 'contactPhone' => $phoneN ?? '', 'checkIn' => $in, 'checkOut' => $out, 'people' => $people, 'message' => $msg,
    'test' => bk_test(), 'accountId' => (($__a = acct_session((string)($_POST['account'] ?? ''))) ? $__a['id'] : ''), 'valueInr' => null, 'feeMode' => null, 'feeValue' => null, 'commissionInr' => null, 'settled' => false,
]);
if ($email !== '') bk_mail($email, "Your Veda Heritage request $ref",
    "Hello $name,\n\nWe received your request to {$prov['name']} for $in to $out ($people people). Your reference is $ref.\n\nWe check each request and pass it to the partner, who will confirm directly with you. Payment is made to the partner on site. Quote $ref in any message.\n\nVeda Heritage");
notify('New booking request ' . $ref, "A traveller asked {$prov['name']} for $in to $out. Open the admin page (Bookings tab) to send it to the partner.");
public_out(200, ['ok' => true, 'ref' => $ref]);
