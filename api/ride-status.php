<?php
// Public: the traveller's ride status, with the driver details and the trip code once a driver accepts. Needs the private ride token.
define('VH_LIB', 1);
require __DIR__ . '/lib/intake.php';
$err = fn(string $m, int $c = 422) => public_out($c, ['ok' => false, 'error' => $m]);
$ref = (string)($_GET['ref'] ?? ''); $tok = (string)($_GET['t'] ?? '');
if (!rate_ok('booking-pay', 60, 3600)) $err('Too many attempts.', 429);
$b = bk_find_ref($ref);
if (!$b || ($b['kind'] ?? '') !== 'ride' || !bk_token_ok($b['payTokenHash'] ?? '', $tok)) $err('Not found.', 404);
$out = ['ok' => true, 'ref' => $b['ref'], 'status' => $b['status'], 'amountInr' => $b['amountInr'], 'paid' => ($b['payment']['status'] ?? '') === 'paid'];
if (in_array($b['status'], ['assigned', 'started'], true)) {
    $out['driver'] = ['name' => $b['driver']['name'], 'phone' => $b['driver']['phone'], 'vehicleNo' => $b['driver']['vehicleNo']]; $out['tripCode'] = $b['otp'] ?? null;
}
public_out(200, $out);
