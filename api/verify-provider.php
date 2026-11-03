<?php
// Opened from the confirmation email. Marks the business email as verified.
define('VH_LIB', 1);
require __DIR__ . '/lib/common.php';
header('Content-Type: text/html; charset=utf-8'); header('Cache-Control: no-store'); header('X-Robots-Tag: noindex, nofollow'); header('Referrer-Policy: no-referrer');
$page = fn(string $t) => print('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email confirmation</title><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem"><h1>' . htmlspecialchars($t) . '</h1><p><a href="/">Back to Veda Heritage</a></p></body>');
$id = (string)($_GET['id'] ?? ''); $t = (string)($_GET['t'] ?? '');
if (!valid_id($id) || !preg_match('/^[0-9a-f]{48}$/', $t)) { http_response_code(400); $page('This link is not valid.'); exit; }
if (!rate_ok('provider-verify', 20, 3600)) { http_response_code(429); $page('Too many attempts. Please try later.'); exit; }
$path = market_dir('providers') . "/$id.json"; $s = json_file($path);
if (!$s || !hash_equals((string)($s['tokenHash'] ?? ''), hash('sha256', $t)) || ($s['tokenExpires'] ?? 0) < time()) { http_response_code(400); $page('This link is not valid or has expired. Please apply again.'); exit; }
$s['emailVerified'] = true; $s['emailVerifiedAt'] = gmdate('c'); save_json($path, $s);
$page('Thank you. Your email is confirmed. We will contact you on your business phone number to complete the check.');
