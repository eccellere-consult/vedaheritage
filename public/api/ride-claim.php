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
if ($_SERVER['REQUEST_METHOD'] !== 'POST') public_out(200, ['ok' => true, 'ride' => ride_view($b, $pid)]);
$p = json_file(market_dir('providers') . "/$pid.json"); if (!$p) $err('This partner is not active.', 403);
[$x, $e] = ride_claim_do($id, $p, (string)($in['driverName'] ?? ''), (string)($in['driverPhone'] ?? ''), (string)($in['vehicleNo'] ?? ''));
if (!$x) $err($e, $e === 'This ride was already taken by another driver.' ? 409 : 422);
public_out(200, ['ok' => true, 'ride' => ride_view($x, $pid)]);
