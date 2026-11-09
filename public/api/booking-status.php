<?php
// Public: which booking features are open, and what travellers can book. Nothing private is returned.
define('VH_LIB', 1);
require __DIR__ . '/lib/commerce.php';
header('Cache-Control: no-store');
$cfg = bk_config(); $caps = [];
foreach (['enquiries', 'stays', 'rides', 'payments'] as $c) $caps[$c] = bk_open($c, $cfg);
$partners = []; $stays = []; $rides = null;
foreach (bk_providers() as $p) {
    if (!bk_partner_ok($p)) continue;
    $base = ['id' => $p['id'], 'name' => $p['name'], 'type' => $p['type'], 'typeLabel' => PROVIDER_TYPES[$p['type']][0] ?? $p['type'], 'districts' => $p['districts'], 'summary' => $p['summary']];
    if ($caps['enquiries']) $partners[] = $base;
    if ($caps['stays'] && $p['type'] === 'stay' && !empty($p['inventory']['rooms'])) $stays[] = $base + ['rooms' => array_map(fn($r) => ['id' => $r['id'], 'name' => $r['name'], 'capacity' => (int)$r['capacity'], 'rateInr' => (float)$r['rateInr']], $p['inventory']['rooms'])];
}
if ($caps['rides']) {
    $veh = []; foreach (RIDE_VEHICLES as $k => $label) if (ride_rate($cfg, $k)) $veh[] = ['id' => $k, 'label' => $label];
    $pts = []; foreach (RIDE_POINTS as $k => $v) $pts[] = ['id' => $k, 'label' => $v[0], 'district' => $v[1]];
    $rides = ['vehicles' => $veh, 'points' => $pts];
}
public_out(200, ['ok' => true, 'open' => $caps['enquiries'], 'caps' => $caps, 'partners' => $partners, 'stays' => $stays, 'rides' => $rides]);
