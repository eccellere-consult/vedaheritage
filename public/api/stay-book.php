<?php
// Public: book a room. Priced and checked for availability here. With payments open the dates are held for 30 minutes
// and the traveller pays online; otherwise it becomes a request paid on site. Locked until "Stay booking" is on.
define('VH_LIB', 1);
require __DIR__ . '/lib/intake.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') public_out(405, ['ok' => false, 'error' => 'POST only.']);
$err = fn(string $m, int $c = 422) => public_out($c, ['ok' => false, 'error' => $m]);
bk_gate('stays', $err);
if (!empty($_POST['website'])) public_out(200, ['ok' => true]);
$t = traveller_fields($err);
$pid = (string)($_POST['providerId'] ?? ''); $roomId = (string)($_POST['roomId'] ?? ''); $in = (string)($_POST['checkIn'] ?? ''); $out = (string)($_POST['checkOut'] ?? '');
$okDate = fn($d) => (bool)preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) && strtotime($d) !== false;
$p = valid_id($pid) ? json_file(market_dir('providers') . "/$pid.json") : null;
if (!$p || !bk_partner_ok($p) || ($p['type'] ?? '') !== 'stay') $err('This stay cannot take bookings right now.', 404);
if (!$okDate($in) || !$okDate($out) || $in < gmdate('Y-m-d', time() - 86400)) $err('Please choose valid dates (not in the past).');
if (!rate_ok('booking-hour', 6, 3600) || !rate_ok('booking-day', 20, 86400)) $err('Too many requests. Please try again later.', 429);

$cfg = bk_config(); $lock = fopen(bk_dir() . '/stay.lock', 'c'); flock($lock, LOCK_EX);   // one booking at a time, so two travellers cannot take the last room
$q = stay_quote($p, $roomId, $in, $out, $t['guests']); if (is_string($q)) { flock($lock, LOCK_UN); $err($q, 409); }
$online = online_ok($cfg) && !empty($p['inventory']['razorpayAccountId']);
$fee = bk_fee_for($p, $cfg); $id = new_id(); $ref = bk_ref(); [$tok, $hash] = bk_token_new();
try { $bd = bk_breakdown($q['amountInr'], $fee, $cfg); } catch (Throwable $e) { flock($lock, LOCK_UN); $err('This room cannot be booked online right now.'); }
$b = ['id' => $id, 'ref' => $ref, 'kind' => 'stay', 'status' => $online ? 'pay_pending' : 'new', 'created' => gmdate('c'),
    'providerId' => $pid, 'providerName' => $p['name'], 'providerType' => 'stay', 'districts' => $p['districts'],
    'name' => $t['name'], 'contactEmail' => $t['contactEmail'], 'contactPhone' => $t['contactPhone'], 'checkIn' => $in, 'checkOut' => $out, 'people' => $t['guests'], 'guests' => $t['guests'], 'message' => $t['message'],
    'roomId' => $roomId, 'roomName' => $q['room']['name'], 'nights' => $q['nights'], 'valueInr' => $q['amountInr'], 'feeMode' => $fee['mode'], 'feeValue' => $fee['value'], 'commissionInr' => $bd['feeInr'], 'settled' => false,
    'test' => bk_test(), 'payTokenHash' => $hash, 'payment' => ['mode' => $online ? 'online' : 'onsite', 'status' => $online ? 'unpaid' : 'onsite']] + $bd;
if ($online) $b['holdUntil'] = time() + STAY_HOLD_MINUTES * 60;
bk_put($b); flock($lock, LOCK_UN);
if (!$online && $t['contactEmail'] !== '') bk_mail($t['contactEmail'], "Your Veda Heritage request $ref", "Hello {$t['name']},\n\nWe received your stay request at {$p['name']} ({$q['room']['name']}), $in to $out, {$t['guests']} guests. Price: Rs {$q['amountInr']}. Reference $ref.\n\nWe pass it to the partner, who confirms with you. You pay the partner on site.\n\nVeda Heritage");
notify('New stay ' . ($online ? 'booking (awaiting payment) ' : 'request ') . $ref, "{$p['name']}, $in to $out. Open Bookings in the admin.");
public_out(200, ['ok' => true, 'ref' => $ref, 'mode' => $online ? 'online' : 'onsite', 'amountInr' => $q['amountInr'], 'nights' => $q['nights'], 'payToken' => $online ? $tok : null, 'holdMinutes' => $online ? STAY_HOLD_MINUTES : null]);
