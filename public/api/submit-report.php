<?php
// "Report a problem" about a directory listing (wrong contact, closed, misleading advert, overcharging).
define('VH_LIB', 1);
require __DIR__ . '/lib/common.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') public_out(405, ['ok' => false, 'error' => 'POST only.']);
if (!empty($_POST['website'])) public_out(200, ['ok' => true]); // honeypot
$err = fn(string $m, int $c = 422) => public_out($c, ['ok' => false, 'error' => $m]);
$pid = (string)($_POST['providerId'] ?? ''); $reason = (string)($_POST['reason'] ?? ''); $details = clean_text($_POST['details'] ?? '', 500); $contact = trim((string)($_POST['contactEmail'] ?? ''));
if (!valid_id($pid)) $err('Unknown listing.', 404);
$p = json_file(market_dir('providers') . "/$pid.json");
if (!$p || !in_array($p['status'] ?? '', ['approved', 'suspended'], true)) $err('Unknown listing.', 404);
if (!in_array($reason, ['wrong-contact', 'closed', 'misleading-ad', 'overcharging', 'unsafe', 'other'], true)) $err('Please choose a reason.');
if (mb_strlen($details) < 10) $err('Please add a short description of the problem.');
if ($contact !== '' && !valid_email($contact)) $err('That email address does not look right.');
if (has_link($details)) $err('Please leave web links out of your message.');
if (!rate_ok('provider-report', 5, 3600)) $err('Too many reports. Please try again later.', 429);
$id = new_id();
save_json(market_dir('reports') . "/$id.json", ['id' => $id, 'providerId' => $pid, 'providerName' => $p['name'], 'reason' => $reason, 'details' => $details, 'contactEmail' => $contact, 'created' => gmdate('c'), 'status' => 'open']);
notify('Directory report', "A report was filed about \"{$p['name']}\" ($reason). Review it in the admin page (Providers tab).");
public_out(200, ['ok' => true]);
