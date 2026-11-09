<?php
// Driver side (private link from the dispatch email): GET shows the ride; POST claims it. First valid claim wins.
define('VH_LIB', 1);
require __DIR__ . '/lib/intake.php';
$err = fn(string $m, int $c = 422) => public_out($c, ['ok' => false, 'error' => $m]);
bk_gate('rides', $err);
$in = $_SERVER['REQUEST_METHOD'] === 'POST' ? (json_decode((string)file_get_contents('php://input'), true) ?: []) : $_GET;
$id = (string)($in['id'] ?? ''); $pid = (string)($in['p'] ?? ''); $tok = (string)($in['t'] ?? '');
if (!rate_ok('booking-driver', 60, 3600)) $err('Too many attempts.', 429);
$b = bk_load($id); $mine = null;
if ($b) foreach (($b['dispatch'] ?? []) as $d) if (($d['providerId'] ?? '') === $pid && bk_token_ok($d['tokenHash'] ?? '', $tok)) $mine = $d;
if (!$b || !$mine || ($b['kind'] ?? '') !== 'ride') $err('This link is not valid.', 404);
$view = fn($x) => ['ref' => $x['ref'], 'pickup' => RIDE_POINTS[$x['pickupId']][0], 'drop' => RIDE_POINTS[$x['dropId']][0], 'when' => $x['when'], 'vehicle' => RIDE_VEHICLES[$x['vehicle']] ?? $x['vehicle'], 'guests' => $x['guests'], 'km' => $x['km'],
    'fareInr' => $x['amountInr'], 'online' => ($x['payment']['mode'] ?? '') === 'online', 'status' => $x['status'], 'mine' => ($x['driver']['providerId'] ?? '') === $pid, 'note' => $x['message'] ?? ''];
if ($_SERVER['REQUEST_METHOD'] !== 'POST') public_out(200, ['ok' => true, 'ride' => $view($b)]);

$name = clean_text($in['driverName'] ?? '', 60); $phone = normalise_phone((string)($in['driverPhone'] ?? '')); $veh = strtoupper(clean_text($in['vehicleNo'] ?? '', 14));
if ($name === '' || !$phone || !preg_match('/^[A-Z0-9 -]{6,14}$/', $veh)) $err('Please give the driver name, phone number and vehicle number.');
$p = json_file(market_dir('providers') . "/$pid.json"); if (!$p || !bk_partner_ok($p)) $err('This partner is not active.', 403);
$otp = (string)random_int(1000, 9999); $cfg = bk_config(); $won = false;
$x = bk_locked($id, function ($r) use ($pid, $name, $phone, $veh, $otp, $p, $cfg, &$won) {
    if ($r['status'] === 'assigned' && ($r['driver']['providerId'] ?? '') === $pid) return null;   // same partner re-opening: no change
    if ($r['status'] !== 'searching') return null;
    $r['driver'] = ['providerId' => $pid, 'name' => $name, 'phone' => $phone, 'vehicleNo' => $veh]; $r['otp'] = $otp; $r['status'] = 'assigned'; $r['assignedOn'] = gmdate('c');
    $r['providerId'] = $pid; $r['providerName'] = $p['name'];
    $fee = bk_fee_for($p, $cfg); $r['feeMode'] = $fee['mode']; $r['feeValue'] = $fee['value'];
    try { $bd = bk_breakdown((float)$r['amountInr'], $fee, $cfg); foreach ($bd as $k => $v) $r[$k] = $v; $r['commissionInr'] = $bd['feeInr']; } catch (Throwable $e) { /* keep the default split */ }
    $won = true; return $r;
});
if (!$won) $err('This ride was already taken by another driver.', 409);
$x = pay_transfer($x);
if (!empty($x['contactEmail'])) send_mail($x['contactEmail'], 'Your driver for ' . $x['ref'], "Your driver is on the way.\n\nDriver: $name, $phone\nVehicle: $veh\nTrip code: $otp (tell the driver this code when the trip starts)\nRide: " . RIDE_POINTS[$x['pickupId']][0] . ' to ' . RIDE_POINTS[$x['dropId']][0] . ", {$x['when']}\n\nVeda Heritage");
public_out(200, ['ok' => true, 'ride' => $view($x)]);
