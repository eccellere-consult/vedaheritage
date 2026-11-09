<?php
// Razorpay webhook. Verified with the webhook secret; every event id is processed once. Set the URL in the Razorpay dashboard to
// https://<site>/api/razorpay-webhook.php and subscribe to payment.captured, order.paid and refund.processed.
define('VH_LIB', 1);
require __DIR__ . '/lib/intake.php';
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') public_out(405, ['ok' => false]);
$raw = (string)file_get_contents('php://input');
if (!rzp_webhook_ok($raw, (string)($_SERVER['HTTP_X_RAZORPAY_SIGNATURE'] ?? ''))) public_out(400, ['ok' => false, 'error' => 'bad signature']);
$eid = preg_replace('/[^A-Za-z0-9_-]/', '', (string)($_SERVER['HTTP_X_RAZORPAY_EVENT_ID'] ?? ''));
if ($eid !== '') { $f = bk_dir('events') . '/' . $eid . '.json'; if (is_file($f)) public_out(200, ['ok' => true, 'duplicate' => true]); save_json($f, ['at' => gmdate('c')]); }
$ev = json_decode($raw, true) ?: []; $type = (string)($ev['event'] ?? '');
if ($type === 'payment.captured' || $type === 'order.paid') {
    $pay = $ev['payload']['payment']['entity'] ?? []; $oid = (string)($pay['order_id'] ?? ($ev['payload']['order']['entity']['id'] ?? ''));
    $order = $ev['payload']['order']['entity'] ?? [];
    $ref = (string)($pay['notes']['ref'] ?? ($order['notes']['ref'] ?? ($order['receipt'] ?? '')));
    $b = $ref !== '' ? bk_find_ref($ref) : null;
    if ($b && $oid !== '' && !empty($pay['id'])) pay_mark_paid($b['id'], $oid, (string)$pay['id'], (int)($pay['amount'] ?? 0));
} elseif ($type === 'refund.processed') {
    $pay = $ev['payload']['payment']['entity'] ?? []; $pid = (string)($pay['id'] ?? '');
    foreach (glob(bk_dir('items') . '/*.json') ?: [] as $fx) { $b = json_file($fx); if ($b && ($b['payment']['paymentId'] ?? '') === $pid && $pid !== '') { audit_booking($b['ref'], 'refund processed'); break; } }
}
public_out(200, ['ok' => true]);
function audit_booking(string $ref, string $what): void { @file_put_contents(vh_data_dir() . '/bookings/events.log', gmdate('c') . " $ref $what\n", FILE_APPEND | LOCK_EX); }
