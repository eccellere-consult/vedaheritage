<?php
// Service-provider directory: a business applies to be listed. Public fields are limited to what a
// visitor needs to make contact; the person's own details and credential number stay PRIVATE.
// Nothing is published until an admin verifies it. See docs/DIRECTORY_MODEL.md.
define('VH_LIB', 1);
require __DIR__ . '/lib/common.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') public_out(405, ['ok' => false, 'error' => 'POST only.']);
if (!empty($_POST['website'])) public_out(200, ['ok' => true]); // honeypot
$err = fn(string $m, int $c = 422) => public_out($c, ['ok' => false, 'error' => $m]);

$name = clean_text($_POST['businessName'] ?? '', 80);
$type = (string)($_POST['type'] ?? '');
$districts = array_values(array_unique(array_filter((array)($_POST['districts'] ?? []), fn($d) => is_string($d))));
$summary = clean_text($_POST['summary'] ?? '', 200);
$phone = trim((string)($_POST['phone'] ?? '')); $email = trim((string)($_POST['email'] ?? ''));
$site = trim((string)($_POST['siteUrl'] ?? '')); $address = clean_text($_POST['address'] ?? '', 120);
$credKind = clean_text($_POST['credentialKind'] ?? '', 80); $credNo = clean_text($_POST['credentialNumber'] ?? '', 40);
$person = clean_text($_POST['contactPerson'] ?? '', 60); $personPhone = trim((string)($_POST['contactPersonPhone'] ?? ''));

if (mb_strlen($name) < 3) $err('Please give the business name.');
if (!isset(PROVIDER_TYPES[$type])) $err('Please choose what kind of service you offer.');
if (!$districts || count($districts) > 3 || array_diff($districts, DISTRICTS)) $err('Please choose 1 to 3 districts you serve.');
if (mb_strlen($summary) < 40) $err('Please describe the service in 40 to 200 characters.');
if (has_link($summary . ' ' . $name . ' ' . $address)) $err('Please leave web links out of the text fields; use the website box.');
if (!($phoneN = normalise_phone($phone))) $err('Please give a business phone number we can call.');
if (!valid_email($email)) $err('Please give a business email address.');
if ($site !== '' && !url_ok($site)) $err('The website must be a full https:// address (not a link shortener).');
if (PROVIDER_TYPES[$type][1] && ($credKind === '' || $credNo === '')) $err('This type of service needs a registration or licence description and number.');
if ($person === '') $err('Please give the name of the person we should speak to.');
if ($personPhone !== '' && !normalise_phone($personPhone)) $err('That contact phone number does not look right.');
foreach (['declare', 'consent', 'terms'] as $k) if (empty($_POST[$k])) $err('Please tick all three confirmations.');

// Duplicate guard: same email, phone or website already applied or listed.
foreach (glob(market_dir('providers') . '/*.json') ?: [] as $f) {
    $o = json_file($f); if (!$o || in_array($o['status'] ?? '', ['rejected', 'removed'], true)) continue;
    if (strtolower($o['email'] ?? '') === strtolower($email) || ($o['phone'] ?? '') === $phoneN || ($site !== '' && host_of($o['website'] ?? '') === host_of($site) && host_of($site) !== '')) $err('This business has already applied or is already listed. Contact us if something has changed.');
}
if (!rate_ok('provider-day', 3, 86400)) $err('Too many applications from this connection. Please try again tomorrow.', 429);

$id = new_id(); $token = bin2hex(random_bytes(24));
$sub = [
    'id' => $id, 'status' => 'pending', 'created' => gmdate('c'),
    'name' => $name, 'type' => $type, 'districts' => $districts, 'summary' => $summary, 'phone' => $phoneN, 'email' => strtolower($email),
    'website' => $site, 'address' => $address, 'credentialKind' => $credKind,
    'credentialNumber' => $credNo, 'contactPerson' => $person, 'contactPersonPhone' => $personPhone,
    'emailVerified' => false, 'tokenHash' => hash('sha256', $token), 'tokenExpires' => time() + 7 * 86400,
];
$base = rtrim(vh_cfg()['site_url'] ?? 'https://www.vedaheritage.co.in', '/');
$sub['emailSent'] = send_mail($email, 'Confirm your email for the Veda Heritage directory',
    "Hello $person,\n\nPlease confirm that $name applied to be listed in the Veda Heritage services directory by opening this link within 7 days:\n\n$base/api/verify-provider.php?id=$id&t=$token\n\nIf you did not apply, ignore this email and nothing will be published.\n\nVeda Heritage");
save_json(market_dir('providers') . "/$id.json", $sub);
notify('New directory application', "\"$name\" applied to be listed. Review it in the admin page (Providers tab).");
public_out(200, ['ok' => true]);
