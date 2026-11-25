<?php
// Public: the browser reports a finished checkout. The signature is checked with our secret before anything is marked paid.
// The Razorpay webhook does the same independently, so a closed tab never loses a payment.
define('VH_LIB', 1);
require __DIR__ . '/lib/intake.php';
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') public_out(405, ['ok' => false, 'error' => 'POST only.']);
$err = fn(string $m, int $c = 422) => public_out($c, ['ok' => false, 'error' => $m]);
bk_gate('payments', $err);
$in = json_decode((string)file_get_contents('php://input'), true) ?: [];
$ref = (string)($in['ref'] ?? ''); $tok = (string)($in['token'] ?? '');
$oid = (string)($in['razorpay_order_id'] ?? ''); $pid = (string)($in['razorpay_payment_id'] ?? ''); $sig = (string)($in['razorpay_signature'] ?? '');
if (!rate_ok('booking-pay', 30, 3600)) $err('Too many attempts. Please try again later.', 429);
$b = bk_find_ref($ref);
if (!$b || !bk_token_ok($b['payTokenHash'] ?? '', $tok) || ($b['payment']['orderId'] ?? '') !== $oid) $err('This payment could not be matched.', 404);
if (!rzp_sig_ok($oid, $pid, $sig)) $err('The payment signature did not match. If money was taken, we will confirm it shortly by email.', 400);
$b = pay_mark_paid($b['id'], $oid, $pid, rzp_paise((float)$b['amountInr']));
public_out(200, ['ok' => true, 'paid' => ($b['payment']['status'] ?? '') === 'paid', 'ref' => $ref, 'status' => $b['status'] ?? '']);
