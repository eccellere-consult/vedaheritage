<?php
// Public: starts the Razorpay payment for a booking. The amount comes from OUR record, never from the browser.
define('VH_LIB', 1);
require __DIR__ . '/lib/intake.php';
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') public_out(405, ['ok' => false, 'error' => 'POST only.']);
$err = fn(string $m, int $c = 422) => public_out($c, ['ok' => false, 'error' => $m]);
bk_gate('payments', $err);
$in = json_decode((string)file_get_contents('php://input'), true) ?: [];
$ref = (string)($in['ref'] ?? ''); $tok = (string)($in['token'] ?? '');
if (!rate_ok('booking-pay', 30, 3600)) $err('Too many attempts. Please try again later.', 429);
$b = bk_find_ref($ref);
if (!$b || !bk_token_ok($b['payTokenHash'] ?? '', $tok)) $err('This payment link is not valid.', 404);
if (($b['payment']['status'] ?? '') === 'paid') public_out(200, ['ok' => true, 'paid' => true, 'ref' => $b['ref']]);
$o = pay_order($b['id']); if (is_string($o)) $err($o, 409);
public_out(200, ['ok' => true, 'paid' => false, 'keyId' => vh_cfg()['razorpay_key_id'], 'orderId' => $o['payment']['orderId'], 'amountPaise' => rzp_paise((float)$o['amountInr']), 'amountInr' => $o['amountInr'],
    'ref' => $o['ref'], 'kind' => $o['kind'], 'partner' => $o['providerName'], 'summary' => $o['kind'] === 'stay' ? "{$o['roomName']}, {$o['checkIn']} to {$o['checkOut']}" : 'Ride on ' . $o['when'],
    'prefill' => ['name' => $o['name'], 'email' => $o['contactEmail'], 'contact' => $o['contactPhone']]]);
