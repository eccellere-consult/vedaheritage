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
if ($act === 'start') {
    $otp = preg_replace('/\D/', '', (string)($in['otp'] ?? ''));
    $r = bk_locked($id, function ($x) use ($otp) { if ($x['status'] !== 'assigned' || !hash_equals((string)($x['otp'] ?? ''), $otp)) return null; $x['status'] = 'started'; $x['startedOn'] = gmdate('c'); return $x; });
    if (!$r) $err('The trip code is not right, or the trip already started.');
    public_out(200, ['ok' => true, 'status' => 'started']);
}
if ($act === 'complete') {
    $r = bk_locked($id, function ($x) { if ($x['status'] !== 'started') return null; $x['status'] = 'completed'; $x['completedOn'] = gmdate('Y-m-d'); foreach (['contactEmail', 'contactPhone', 'message'] as $k) $x[$k] = ''; return $x; });
    if (!$r) $err('Start the trip first.');
    $msg = ''; if (!empty($r['payment']['transferId'])) { [$ok, $msg] = pay_release($id); }
    public_out(200, ['ok' => true, 'status' => 'completed', 'payout' => $msg]);
}
$err('Unknown action.');
