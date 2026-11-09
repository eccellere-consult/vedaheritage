<?php
// Public: fare estimate for a ride, from the platform rate card and the distance between two fixed points.
define('VH_LIB', 1);
require __DIR__ . '/lib/intake.php';
$err = fn(string $m, int $c = 422) => public_out($c, ['ok' => false, 'error' => $m]);
bk_gate('rides', $err);
$a = (string)($_GET['pickup'] ?? ''); $b = (string)($_GET['drop'] ?? ''); $v = (string)($_GET['vehicle'] ?? ''); $when = (string)($_GET['when'] ?? '');
$cfg = bk_config(); $rate = ride_rate($cfg, $v); $km = ride_km($a, $b);
if (!$rate || $km === null) $err('Choose two different points and a vehicle.');
$ts = ride_ts($when); if ($ts === false) $err('Choose the pickup date and time.');
$n = count(ride_partners_for(RIDE_POINTS[$a][1], $v));
public_out(200, ['ok' => true, 'km' => $km, 'fareInr' => ride_fare($rate, $km, $ts), 'partners' => $n, 'note' => 'An estimate from the distance between the two points. Extra stops and waiting are agreed with the driver.']);
