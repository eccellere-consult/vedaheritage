<?php
// Shared validation for traveller bookings (stays and rides).
if (!defined('VH_LIB')) define('VH_LIB', 1);
require_once __DIR__ . '/commerce.php';

/** Reads and validates the traveller fields common to every booking. Stops the request with a plain message on a problem. */
function traveller_fields(callable $err): array {
    $name = clean_text($_POST['name'] ?? '', 60); $email = trim((string)($_POST['contactEmail'] ?? '')); $phone = trim((string)($_POST['contactPhone'] ?? ''));
    $msg = clean_text($_POST['message'] ?? '', 800); $guests = (int)($_POST['guests'] ?? 0);
    if ($name === '') $err('Please add your name.');
    if ($email === '' && $phone === '') $err('Please give an email address or a phone number.');
    if ($email !== '' && !valid_email($email)) $err('That email address does not look right.');
    $phoneN = ''; if ($phone !== '') { $phoneN = normalise_phone($phone) ?? ''; if ($phoneN === '') $err('That phone number does not look right.'); }
    if (has_link($msg)) $err('Please leave web links out of your message.');
    if ($guests < 1 || $guests > 30) $err('Please say how many people (1 to 30).');
    if (empty($_POST['consent'])) $err('Please tick the confirmation that we may share these details with the partner.');
    return ['name' => $name, 'contactEmail' => strtolower($email), 'contactPhone' => $phoneN, 'message' => $msg, 'guests' => $guests];
}
/** Whether this booking is taken online (payments open and the booking can be priced) or paid on site. */
function online_ok(array $cfg): bool { return bk_open('payments', $cfg) && bk_open('commission', $cfg); }
