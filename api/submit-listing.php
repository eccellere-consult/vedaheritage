<?php
// Marketplace: seller submits an item for moderation. Seller contact details stay PRIVATE
// (data dir outside public_html); nothing is published until an admin approves it.
define('VH_LIB', 1);
require __DIR__ . '/lib/common.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') public_out(405, ['ok' => false, 'error' => 'POST only.']);
if (!empty($_POST['website'])) public_out(200, ['ok' => true]); // honeypot

$err = fn(string $m, int $c = 422) => public_out($c, ['ok' => false, 'error' => $m]);

$title = clean_text($_POST['title'] ?? '', 90);
$desc  = clean_text($_POST['description'] ?? '', 1500);
$cat   = (string)($_POST['category'] ?? '');
$cond  = (string)($_POST['condition'] ?? '');
$price = $_POST['price'] ?? '';
$district = clean_text($_POST['district'] ?? '', 40);
$name  = clean_text($_POST['sellerName'] ?? '', 40);
$email = trim((string)($_POST['contactEmail'] ?? ''));
$phone = trim((string)($_POST['contactPhone'] ?? ''));

if (!isset(MARKET_CATEGORIES[$cat]) || !isset(MARKET_CONDITIONS[$cond])) $err('Please choose a category and condition.');
if (!is_string($price) || !preg_match('/^\d{1,7}$/', $price)) $err('Please enter the price as a whole number of rupees.');
if ($email === '' && $phone === '') $err('Please give an email address or a phone number so we can introduce a buyer.');
if ($email !== '' && !valid_email($email)) $err('That email address does not look right.');
if ($phone !== '' && !($phoneN = normalise_phone($phone))) $err('That phone number does not look right.');
if (has_link($title . ' ' . $desc)) $err('Please leave web links out of the title and description.');
if (empty($_POST['declare']) || empty($_POST['consent'])) $err('Please tick both confirmations.');

$given = 0; foreach (($_FILES['photos']['error'] ?? []) as $e) if ($e !== UPLOAD_ERR_NO_FILE) $given++;
if ($given < 1) $err('Please add at least one photo (up to 3).');
if (!rate_ok('listing-hour', 3, 3600) || !rate_ok('listing-day', 8, 86400)) $err('Too many submissions. Please try again later.', 429);

$files = $_FILES['photos'] ?? null; $jpgs = [];
if ($files && is_array($files['name'])) {
    foreach ($files['name'] as $i => $_) {
        if ($files['error'][$i] === UPLOAD_ERR_NO_FILE) continue;
        if (count($jpgs) >= 3) break;
        if ($files['error'][$i] !== UPLOAD_ERR_OK || $files['size'][$i] > 6 * 1024 * 1024) $err('Each photo must be under 6 MB.');
        $jpg = reencode_jpeg($files['tmp_name'][$i]);
        if (!$jpg) $err('Photos must be JPG, PNG or WebP.');
        $jpgs[] = $jpg;
    }
}
if (!$jpgs) $err('Please add at least one photo (up to 3).');

$id = new_id();
$sub = [
    'id' => $id, 'status' => 'pending', 'created' => gmdate('c'),
    'title' => $title, 'description' => $desc, 'category' => $cat, 'condition' => $cond, 'priceInr' => (int)$price,
    'district' => $district, 'sellerName' => $name,
    'contactEmail' => $email, 'contactPhone' => $phoneN ?? '',
    'declared' => true, 'photos' => [],
];
foreach ($jpgs as $n => $jpg) {
    $f = market_dir('photos') . "/$id-" . ($n + 1) . '.jpg';
    if (@file_put_contents($f, $jpg) === false) $err('We could not save your photos right now.', 503);
    $sub['photos'][] = basename($f);
}
save_json(market_dir('submissions') . "/$id.json", $sub);
notify('New marketplace submission', "A seller submitted \"$title\". Review it in the admin page (Marketplace tab).");
public_out(200, ['ok' => true]);
