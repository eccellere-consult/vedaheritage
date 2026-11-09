<?php
// Bookings module (phase 2): partner enquiries with a booking reference, a commission ledger and a monthly settlement sheet.
// EVERYTHING here is locked until the admin records the licences or approvals each capability needs (see BK_CAPS) and
// switches it on. Locked is the default. Private data (traveller contact details) lives in the data dir, never in GitHub.
// Stays, rides and Razorpay payments live in lib/commerce.php. Locked is the default for every capability.
if (!defined('VH_LIB')) define('VH_LIB', 1);
require_once __DIR__ . '/common.php';

/** id => [label, what it does, buildable (software exists), checklist key => label, evidence key => [label, regex or null]] */
const BK_CAPS = [
    'enquiries' => ['Partner enquiries and booking references', 'Travellers send a stay or transport request to a verified partner through the site. Each request gets a booking reference. You pass it to the partner; payment happens directly on site.', true,
        ['terms' => 'Terms of use and privacy notice for bookings are published on the site',
         'grievance' => 'A grievance officer is named and their contact is published',
         'agreements' => 'A written agreement is signed with every partner you switch on below',
         'retention' => 'You agreed how long traveller details are kept (the software deletes them when a booking is completed or cancelled)'],
        ['grievanceOfficer' => ['Grievance officer: name and email or phone', null]]],
    'commission' => ['Commission ledger and monthly settlement', 'Records the booking value and your commission on completed bookings, and builds a monthly settlement sheet per partner (with GST on the commission) as a CSV for your accountant.', true,
        ['gst' => 'You are registered for GST (or your accountant confirms you do not need to be)',
         'invoicing' => 'Your accountant agreed how commission invoices are raised and how GST on commission is shown',
         'agreement' => 'Each partner agreement states the commission rate and the monthly settlement'],
        ['gstin' => ['GSTIN (15 characters), or "exempt: <accountant note>"', '/^([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]|exempt:.{6,})$/i']]],
    'payments' => ['Online payments with split commission (Razorpay)', 'Takes the traveller\'s payment on the site through Razorpay. After payment the partner\'s share is transferred (held until the stay or trip is done, then released) and your fee stays with you. Needs the Razorpay keys in vh-config.php and a Razorpay linked account ID for each partner.', true,
        ['aggregator' => 'Your payment aggregator account is approved and Route (split payments) is active',
         'ca' => 'Your chartered accountant signed off GST, TCS and TDS handling (rates are set under Your fee)',
         'refunds' => 'A refund and cancellation policy is published',
         'legal' => 'The terms for taking payments were reviewed'],
        ['aggregatorName' => ['Payment aggregator name and merchant ID', null]]],
    'stays' => ['Stay booking (rooms, availability, instant booking)', 'Stay partners list rooms with a nightly rate. Travellers search dates, see the price and book. Dates are blocked for the room while a booking is held or paid. With payments open they pay online; otherwise it becomes a request paid on site.', true,
        ['registration' => 'Every stay you switch on has a valid Kerala Tourism registration or classification, checked',
         'pricing' => 'Room rates shown include or state taxes as the partner agreed',
         'policy' => 'A cancellation policy for stays is published'],
        ['stayPolicyNote' => ['Where the stay cancellation policy is published (page or note)', null]]],
    'rides' => ['Ride booking and dispatch (cabs, autos)', 'Travellers book a ride with a fare estimate from the partner rate card. The request goes to eligible partners; the first driver to accept gets it. The traveller receives driver details and a trip code; the driver starts the trip with that code and completes it. No live GPS tracking.', true,
        ['licence' => 'The licence or approval needed to run ride dispatch is in place',
         'drivers' => 'Driver verification and insurance process is in place for every partner',
         'fares' => 'Rate cards meet the applicable fare and safety rules'],
        ['aggregatorLicence' => ['Licence number and issuing authority', null]]],
];
const BK_STATUSES = ['new', 'sent', 'confirmed', 'completed', 'cancelled', 'declined', 'pay_pending', 'paid', 'searching', 'assigned', 'started', 'expired'];
const BK_PARTNER_TYPES = ['stay', 'transport'];

function bk_dir(string $sub = ''): string {
    $d = vh_data_dir() . '/bookings' . ($sub !== '' ? "/$sub" : '');
    if (!is_dir($d)) @mkdir($d, 0700, true);
    return $d;
}
function bk_config(): array {
    $c = json_file(bk_dir() . '/config.json') ?: [];
    $c['caps'] = is_array($c['caps'] ?? null) ? $c['caps'] : [];
    // Fee model: a percentage of the booking value, or a flat amount per completed booking. Default 1 percent.
    $fee = is_array($c['fee'] ?? null) ? $c['fee'] : ['mode' => 'percent', 'value' => isset($c['commissionRate']) ? (float)$c['commissionRate'] : 1.0];
    $c['fee'] = bk_fee_clean($fee['mode'] ?? 'percent', $fee['value'] ?? 1.0) ?? ['mode' => 'percent', 'value' => 1.0];
    $c['gstRate'] = isset($c['gstRate']) ? (float)$c['gstRate'] : 18.0;
    // Statutory amounts held back from the partner's payout on online payments. Default 0: set only with your accountant's advice.
    $c['rideRates'] = is_array($c['rideRates'] ?? null) ? $c['rideRates'] : [
        'auto' => ['baseInr' => 30, 'perKmInr' => 15, 'minInr' => 50, 'nightPct' => 25],
        'car' => ['baseInr' => 50, 'perKmInr' => 14, 'minInr' => 150, 'nightPct' => 20],
        'suv' => ['baseInr' => 80, 'perKmInr' => 18, 'minInr' => 250, 'nightPct' => 20]];
    $c['tcsPercent'] = isset($c['tcsPercent']) ? (float)$c['tcsPercent'] : 0.0;
    $c['tdsPercent'] = isset($c['tdsPercent']) ? (float)$c['tdsPercent'] : 0.0;
    return $c;
}
/** Validated fee {mode, value}, or null. percent: 0 to 20. flat: 0 to 5000 rupees per completed booking. */
function bk_fee_clean($mode, $value): ?array {
    if (!in_array($mode, ['percent', 'flat'], true) || !is_numeric($value)) return null;
    $v = round((float)$value, 2);
    if ($v < 0 || $v > ($mode === 'percent' ? 20 : 5000)) return null;
    return ['mode' => $mode, 'value' => $v];
}
function bk_save(array $c): void { save_json(bk_dir() . '/config.json', $c); }

/** Missing prerequisites for a capability, in plain words. Empty = ready to switch on. */
function bk_missing(string $cap, array $cfg): array {
    $def = BK_CAPS[$cap] ?? null; if (!$def) return ['Unknown capability.'];
    $st = $cfg['caps'][$cap] ?? []; $m = [];
    foreach ($def[3] as $k => $label) if (empty($st['checklist'][$k])) $m[] = $label;
    foreach ($def[4] as $k => $e) {
        $v = trim((string)($st['evidence'][$k] ?? ''));
        if ($v === '') $m[] = 'Record: ' . $e[0];
        elseif ($e[1] && !preg_match($e[1], $v)) $m[] = 'Check the format of: ' . $e[0];
    }
    if ($cap === 'payments') {
        if (!function_exists('rzp_keys_ok') || !rzp_keys_ok()) $m[] = 'Add razorpay_key_id, razorpay_key_secret and razorpay_webhook_secret to vh-config.php';
        if (!bk_open('enquiries', $cfg)) $m[] = 'Switch on Partner enquiries first (it carries the partner agreements)';
        if (!bk_open('commission', $cfg)) $m[] = 'Switch on Commission and settlement first (it computes your fee)';
    }
    return $m;
}
/** True only when the software exists, every prerequisite is recorded AND the admin switched it on. */
function bk_open(string $cap, ?array $cfg = null): bool {
    $cfg = $cfg ?? bk_config(); $def = BK_CAPS[$cap] ?? null;
    return $def && $def[2] && !empty($cfg['caps'][$cap]['enabled']) && !bk_missing($cap, $cfg);
}
/** Public-facing gate: stops the request with a plain message while the capability is locked. */
function bk_gate(string $cap, callable $deny): void {
    if (!bk_open($cap)) $deny('Bookings are not open yet.', 403);
}

function bk_ref(): string {
    $abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    for ($t = 0; $t < 20; $t++) {
        $r = 'VH-' . gmdate('ym') . '-'; for ($i = 0; $i < 4; $i++) $r .= $abc[random_int(0, strlen($abc) - 1)];
        if (!glob(bk_dir('items') . '/*.json') || !array_filter(glob(bk_dir('items') . '/*.json'), fn($f) => (json_file($f)['ref'] ?? '') === $r)) return $r;
    }
    return 'VH-' . gmdate('ym') . '-' . strtoupper(bin2hex(random_bytes(3)));
}

/** A provider is a booking partner only when verified, in a bookable type, flagged as partner and the agreement is recorded. */
function bk_partner_ok(array $p): bool {
    return ($p['status'] ?? '') === 'approved' && in_array($p['type'] ?? '', BK_PARTNER_TYPES, true)
        && !empty($p['booking']['partner']) && !empty($p['booking']['agreementOn']) && !empty($p['booking']['registrationChecked']);
}
/** The partner's own fee if set, else the default fee. */
function bk_fee_for(array $p, array $cfg): array {
    $f = bk_fee_clean($p['booking']['feeMode'] ?? null, $p['booking']['feeValue'] ?? null);
    return $f ?? $cfg['fee'];
}
function bk_fee_label(array $f): string { return $f['mode'] === 'flat' ? 'Rs ' . $f['value'] . ' per booking' : $f['value'] . '% of the booking value'; }
function bk_providers(): array {
    $o = []; foreach (glob(market_dir('providers') . '/*.json') ?: [] as $f) { $d = json_file($f); if ($d) $o[$d['id']] = $d; } return $o;
}
/** Commission in rupees, computed in code (never typed by hand). Flat fees never exceed the booking value when it is known. */
function bk_commission(?float $value, array $fee): float {
    if ($fee['mode'] === 'flat') return round($value !== null && $value > 0 ? min($fee['value'], $value) : $fee['value'], 2);
    return round(($value ?? 0) * $fee['value'] / 100, 2);
}
function bk_settlement(string $month, array $cfg): array {
    $rows = [];
    foreach (glob(bk_dir('items') . '/*.json') ?: [] as $f) {
        $b = json_file($f); if (!$b || ($b['status'] ?? '') !== 'completed' || substr($b['completedOn'] ?? '', 0, 7) !== $month || !isset($b['commissionInr'])) continue;
        $k = $b['providerId']; $r = &$rows[$k];
        if (!isset($r)) $r = ['providerId' => $k, 'provider' => $b['providerName'], 'bookings' => 0, 'valueInr' => 0.0, 'commissionInr' => 0.0, 'settled' => true, 'refs' => []];
        $r['bookings']++; $r['valueInr'] += (float)($b['valueInr'] ?? 0); $r['commissionInr'] += (float)($b['commissionInr'] ?? 0); $r['refs'][] = $b['ref'];
        if (empty($b['settled'])) $r['settled'] = false;
        unset($r);
    }
    foreach ($rows as &$r) { $r['valueInr'] = round($r['valueInr'], 2); $r['commissionInr'] = round($r['commissionInr'], 2); $r['gstInr'] = round($r['commissionInr'] * $cfg['gstRate'] / 100, 2); $r['totalDueInr'] = round($r['commissionInr'] + $r['gstInr'], 2); } unset($r);
    return array_values($rows);
}
function bk_csv(array $rows, string $month): string {
    $q = fn($v) => '"' . str_replace('"', '""', (string)$v) . '"';
    $out = "Month,Partner,Bookings,Booking value (INR),Commission (INR),GST on commission (INR),Total due (INR),Settled,Booking references\n";
    foreach ($rows as $r) $out .= implode(',', [$q($month), $q(preg_match('/^[=+\-@]/', $r['provider']) ? "'" . $r['provider'] : $r['provider']), $r['bookings'], $r['valueInr'], $r['commissionInr'], $r['gstInr'], $r['totalDueInr'], $r['settled'] ? 'yes' : 'no', $q(implode(' ', $r['refs']))]) . "\n";
    return $out;
}
