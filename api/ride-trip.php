<?php
// Driver side: start the trip with the traveller's trip code, then complete it. Completing releases the partner's held payout.
define('VH_LIB', 1);
require __DIR__ . '/lib/intake.php';
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') public_out(405, ['ok' => false]);
$err = fn(string $m, int $c = 422) => public_out($c, ['ok' => false, 'error' => $m]);
bk_gate('rides', $err);
$in = json_decode((string)file_get_contents('php://input'), true) ?: [];
$id = (string)($in['id'] ?? ''); $pid = (string)($in['p'] ?? ''); $tok = (string)($in['t'] ?? ''); $act = (string)($in['action'] ?? '');
if (!rate_ok('booking-driver', 60, 3600)) $err('Too many attempts.', 429);
$b = bk_load($id); $okTok = false;
if ($b) foreach (($b['dispatch'] ?? []) as $d) if (($d['providerId'] ?? '') === $pid && bk_token_ok($d['tokenHash'] ?? '', $tok)) $okTok = true;
if (!$b || !$okTok || ($b['driver']['providerId'] ?? '') !== $pid) $err('This link is not valid for this ride.', 404);
[$ok, $m] = ride_trip_do($id, $pid, $act, (string)($in['otp'] ?? ''));
if (!$ok) $err($m);
public_out(200, ['ok' => true, 'status' => $act === 'start' ? 'started' : 'completed', 'payout' => $m]);
