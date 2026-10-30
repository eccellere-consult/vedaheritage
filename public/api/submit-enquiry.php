<?php
// Marketplace: a buyer asks about a listing. Stored privately; the site owner introduces buyer and seller.
define('VH_LIB', 1);
require __DIR__ . '/lib/common.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') public_out(405, ['ok' => false, 'error' => 'POST only.']);
if (!empty($_POST['website'])) public_out(200, ['ok' => true]); // honeypot
$err = fn(string $m, int $c = 422) => public_out($c, ['ok' => false, 'error' => $m]);

$lid = (string)($_POST['listingId'] ?? '');
$name = clean_text($_POST['name'] ?? '', 60);
$msg = clean_text($_POST['message'] ?? '', 800);
$email = trim((string)($_POST['contactEmail'] ?? '')); $phone = trim((string)($_POST['contactPhone'] ?? ''));
if (!valid_id($lid)) $err('Unknown listing.', 404);
$sub = json_file(market_dir('submissions') . "/$lid.json");
if (!$sub || !in_array($sub['status'] ?? '', ['approved', 'sold'], true)) $err('This listing is not available.', 404);
if ($name === '' || mb_strlen($msg) < 10) $err('Please add your name and a short message.');
if ($email === '' && $phone === '') $err('Please give an email address or a phone number.');
if ($email !== '' && !valid_email($email)) $err('That email address does not look right.');
if ($phone !== '' && !($phoneN = normalise_phone($phone))) $err('That phone number does not look right.');
if (has_link($msg)) $err('Please leave web links out of your message.');
if (empty($_POST['consent'])) $err('Please tick the confirmation.');

if (!rate_ok('enquiry-hour', 5, 3600) || !rate_ok('enquiry-day', 15, 86400)) $err('Too many enquiries. Please try again later.', 429);
$eid = new_id();
save_json(market_dir('enquiries') . "/$eid.json", [
    'id' => $eid, 'listingId' => $lid, 'listingTitle' => $sub['title'], 'created' => gmdate('c'), 'status' => 'open',
    'name' => $name, 'contactEmail' => $email, 'contactPhone' => $phoneN ?? '', 'message' => $msg,
]);
notify('New marketplace enquiry', "Someone asked about \"{$sub['title']}\". Review it in the admin page (Marketplace tab).");
public_out(200, ['ok' => true]);
