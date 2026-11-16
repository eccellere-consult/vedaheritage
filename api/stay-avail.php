<?php
// Public: price and availability of one room for the chosen dates.
define('VH_LIB', 1);
require __DIR__ . '/lib/intake.php';
$err = fn(string $m, int $c = 422) => public_out($c, ['ok' => false, 'error' => $m]);
bk_gate('stays', $err);
if (!rate_ok('booking-avail', 120, 3600)) $err('Too many searches. Please try again later.', 429);
$pid = (string)($_GET['providerId'] ?? ''); $p = valid_id($pid) ? json_file(market_dir('providers') . "/$pid.json") : null;
if (!$p || !bk_partner_ok($p) || ($p['type'] ?? '') !== 'stay') $err('Not found.', 404);
$in = (string)($_GET['checkIn'] ?? ''); $out = (string)($_GET['checkOut'] ?? '');
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $in) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $out) || strtotime($in) === false || strtotime($out) === false) $err('Choose valid dates.');
$q = stay_quote($p, (string)($_GET['roomId'] ?? ''), $in, $out, max(1, (int)($_GET['guests'] ?? 1)));
if (is_string($q)) public_out(200, ['ok' => true, 'available' => false, 'reason' => $q]);
public_out(200, ['ok' => true, 'available' => true, 'nights' => $q['nights'], 'amountInr' => $q['amountInr']]);
