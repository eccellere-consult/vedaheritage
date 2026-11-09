<?php
// Public: is the bookings module open, and which verified partners can take a request? Nothing private is returned.
define('VH_LIB', 1);
require __DIR__ . '/lib/bookings.php';
header('Cache-Control: no-store');
$open = bk_open('enquiries'); $partners = [];
if ($open) foreach (bk_providers() as $p) if (bk_partner_ok($p)) $partners[] = ['id' => $p['id'], 'name' => $p['name'], 'type' => $p['type'], 'typeLabel' => PROVIDER_TYPES[$p['type']][0] ?? $p['type'], 'districts' => $p['districts'], 'summary' => $p['summary']];
public_out(200, ['ok' => true, 'open' => $open, 'partners' => $partners]);
