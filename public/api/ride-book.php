<?php
// Public: book a ride. Priced here from the rate card. Online: pay first, then the ride goes to drivers. Otherwise the ride goes
// to drivers now and the traveller pays the driver. Locked until "Ride booking and dispatch" is on.
define('VH_LIB', 1);
require __DIR__ . '/lib/intake.php';
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') public_out(405, ['ok' => false, 'error' => 'POST only.']);
$err = fn(string $m, int $c = 422) => public_out($c, ['ok' => false, 'error' => $m]);
bk_gate('rides', $err);
if (!empty($_POST['website'])) public_out(200, ['ok' => true]);
$t = traveller_fields($err);
$a = (string)($_POST['pickup'] ?? ''); $d = (string)($_POST['drop'] ?? ''); $v = (string)($_POST['vehicle'] ?? ''); $when = (string)($_POST['when'] ?? '');
$cfg = bk_config(); $rate = ride_rate($cfg, $v); $km = ride_km($a, $d);
if (!$rate || $km === null) $err('Choose two different points and a vehicle.');
$ts = ride_ts($when); if ($ts === false || $ts < time() + 1800 || $ts > time() + 60 * 86400) $err('Choose a pickup time at least 30 minutes from now and within 60 days.');
$seats = ['auto' => 3, 'car' => 4, 'suv' => 6][$v] ?? 4; if ($t['guests'] > $seats) $err("This vehicle seats $seats. Choose a larger one.");
if (!ride_partners_for(RIDE_POINTS[$a][1], $v)) $err('No partner covers this pickup and vehicle yet. Try another vehicle or call us.', 409);
if (!rate_ok('booking-hour', 6, 3600) || !rate_ok('booking-day', 20, 86400)) $err('Too many requests. Please try again later.', 429);
$fare = ride_fare($rate, $km, $ts); $online = online_ok($cfg); $fee = $cfg['fee'];
try { $bd = bk_breakdown($fare, $fee, $cfg); } catch (Throwable $e) { $err('This ride cannot be booked online right now.'); }
$id = new_id(); $ref = bk_ref(); [$tok, $hash] = bk_token_new();
$b = ['id' => $id, 'ref' => $ref, 'kind' => 'ride', 'status' => $online ? 'pay_pending' : 'searching', 'created' => gmdate('c'), 'providerId' => '', 'providerName' => '', 'providerType' => 'transport',
    'name' => $t['name'], 'contactEmail' => $t['contactEmail'], 'contactPhone' => $t['contactPhone'], 'people' => $t['guests'], 'guests' => $t['guests'], 'message' => $t['message'],
    'pickupId' => $a, 'dropId' => $d, 'vehicle' => $v, 'when' => gmdate('Y-m-d H:i', $ts + 19800) . ' IST', 'whenTs' => $ts, 'km' => $km, 'checkIn' => gmdate('Y-m-d', $ts + 19800), 'checkOut' => gmdate('Y-m-d', $ts + 19800),
    'valueInr' => $fare, 'feeMode' => $fee['mode'], 'feeValue' => $fee['value'], 'commissionInr' => $bd['feeInr'], 'settled' => false, 'payTokenHash' => $hash,
    'payment' => ['mode' => $online ? 'online' : 'onsite', 'status' => $online ? 'unpaid' : 'onsite']] + $bd;
bk_put($b);
$sent = 0; if (!$online) $sent = ride_dispatch($b);
if ($t['contactEmail'] !== '') send_mail($t['contactEmail'], "Your Veda Heritage ride $ref", "Hello {$t['name']},\n\nRide {$ref}: " . RIDE_POINTS[$a][0] . ' to ' . RIDE_POINTS[$d][0] . ", {$b['when']}. Estimated fare Rs $fare.\n\n" . ($online ? 'Please complete the payment; we then find your driver.' : 'We are finding you a driver. You will get the driver details and your trip code by email. Pay the driver.') . "\n\nVeda Heritage");
public_out(200, ['ok' => true, 'ref' => $ref, 'mode' => $online ? 'online' : 'onsite', 'amountInr' => $fare, 'km' => $km, 'payToken' => $tok, 'partnersTold' => $sent]);
