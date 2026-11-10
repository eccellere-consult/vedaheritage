<?php
// Commerce: Razorpay payments (Route split), stay booking and ride booking with dispatch. Locked behind the capability
// gates in bookings.php. Money amounts are rupees (float, 2 dp) in our records and integer paise toward Razorpay.
// Every price is computed here from partner data, never taken from the browser.
if (!defined('VH_LIB')) define('VH_LIB', 1);
require_once __DIR__ . '/bookings.php';

const STAY_HOLD_MINUTES = 30;
const ROAD_FACTOR = 1.35;   // straight-line distance to road distance; fares are ESTIMATES
/** Fixed pickup and drop points (approximate centre coordinates). Fares use the distance between two of these. */
const RIDE_POINTS = [
    'trv-airport' => ['Thiruvananthapuram Airport', 'Thiruvananthapuram', 8.4821, 76.9201], 'trv-central' => ['Thiruvananthapuram Central station', 'Thiruvananthapuram', 8.4875, 76.9525],
    'kollam-jn' => ['Kollam Junction station', 'Kollam', 8.8860, 76.5920], 'karunagappally' => ['Karunagappally / Vavvakkavu', 'Kollam', 9.0600, 76.5380], 'amritapuri' => ['Amritapuri', 'Kollam', 9.0925, 76.4903],
    'alappuzha' => ['Alappuzha town and boat jetty', 'Alappuzha', 9.4981, 76.3388], 'kottayam' => ['Kottayam town', 'Kottayam', 9.5916, 76.5222], 'pathanamthitta' => ['Pathanamthitta town', 'Pathanamthitta', 9.2648, 76.7870],
    'kochi-airport' => ['Cochin Airport (Nedumbassery)', 'Ernakulam', 10.1520, 76.4019], 'ernakulam-jn' => ['Ernakulam Junction station', 'Ernakulam', 9.9696, 76.2910], 'fort-kochi' => ['Fort Kochi', 'Ernakulam', 9.9658, 76.2421],
    'munnar' => ['Munnar', 'Idukki', 10.0889, 77.0595], 'thekkady' => ['Thekkady / Kumily', 'Idukki', 9.6050, 77.1610], 'thrissur' => ['Thrissur town', 'Thrissur', 10.5276, 76.2144], 'guruvayur' => ['Guruvayur', 'Thrissur', 10.5940, 76.0410],
    'palakkad' => ['Palakkad town', 'Palakkad', 10.7867, 76.6548], 'malappuram' => ['Malappuram', 'Malappuram', 11.0510, 76.0711], 'calicut-airport' => ['Calicut Airport (Karipur)', 'Malappuram', 11.1368, 75.9553],
    'kozhikode' => ['Kozhikode town', 'Kozhikode', 11.2588, 75.7804], 'wayanad' => ['Kalpetta, Wayanad', 'Wayanad', 11.6103, 76.0830], 'kannur' => ['Kannur town', 'Kannur', 11.8745, 75.3704], 'bekal' => ['Bekal, Kasaragod', 'Kasaragod', 12.3920, 75.0330],
    'varkala' => ['Varkala', 'Thiruvananthapuram', 8.7330, 76.7160], 'kovalam' => ['Kovalam', 'Thiruvananthapuram', 8.4004, 76.9787], 'sabarimala-base' => ['Pamba (Sabarimala base)', 'Pathanamthitta', 9.3430, 77.0780],
];
const RIDE_VEHICLES = ['auto' => 'Auto-rickshaw (3 seats)', 'car' => 'Car (4 seats)', 'suv' => 'SUV or van (6 seats)'];

// ---------------------------------------------------------------- Razorpay
function rzp_keys_ok(): bool { $c = vh_cfg(); return !empty($c['razorpay_key_id']) && !empty($c['razorpay_key_secret']) && !empty($c['razorpay_webhook_secret']); }
function rzp_paise(float $rupees): int { return (int)round($rupees * 100); }
/** Calls the Razorpay API. Returns [httpStatus, decodedBody]. Keys come from vh-config.php only. */
function rzp(string $method, string $path, ?array $body = null): array {
    $c = vh_cfg(); $base = rtrim((string)($c['razorpay_api'] ?? 'https://api.razorpay.com'), '/');
    $ch = curl_init($base . $path);
    curl_setopt_array($ch, [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_USERPWD => ($c['razorpay_key_id'] ?? '') . ':' . ($c['razorpay_key_secret'] ?? ''),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'], CURLOPT_POSTFIELDS => $body === null ? null : json_encode($body)]);
    $out = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE); curl_close($ch);
    return [$code, is_string($out) ? (json_decode($out, true) ?: []) : []];
}
function rzp_sig_ok(string $orderId, string $paymentId, string $sig): bool {
    $secret = (string)(vh_cfg()['razorpay_key_secret'] ?? ''); if ($secret === '') return false;
    return hash_equals(hash_hmac('sha256', $orderId . '|' . $paymentId, $secret), $sig);
}
function rzp_webhook_ok(string $raw, string $sig): bool {
    $secret = (string)(vh_cfg()['razorpay_webhook_secret'] ?? ''); if ($secret === '') return false;
    return hash_equals(hash_hmac('sha256', $raw, $secret), $sig);
}

// ---------------------------------------------------------------- storage
function bk_load(string $id): ?array { return valid_id($id) ? json_file(bk_dir('items') . "/$id.json") : null; }
function bk_put(array $b): void { save_json(bk_dir('items') . '/' . $b['id'] . '.json', $b); }
function bk_find_ref(string $ref): ?array {
    foreach (glob(bk_dir('items') . '/*.json') ?: [] as $f) { $b = json_file($f); if ($b && ($b['ref'] ?? '') === $ref) return $b; } return null;
}
/** Runs $fn(booking) under an exclusive lock on the booking file and saves the result. Returns the saved booking or null if $fn returned null. */
function bk_locked(string $id, callable $fn): ?array {
    if (!valid_id($id)) return null;
    $f = bk_dir('items') . "/$id.json"; $h = @fopen($f, 'c+'); if (!$h) return null;
    flock($h, LOCK_EX); $b = json_decode(stream_get_contents($h) ?: 'null', true); $res = null;
    if (is_array($b)) { $res = $fn($b); if (is_array($res)) { ftruncate($h, 0); rewind($h); fwrite($h, json_encode($res, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)); } }
    flock($h, LOCK_UN); fclose($h); return is_array($res) ? $res : null;
}
function bk_token_new(): array { $t = bin2hex(random_bytes(24)); return [$t, hash('sha256', $t)]; }
function bk_token_ok(string $hash, string $given): bool { return $hash !== '' && $given !== '' && hash_equals($hash, hash('sha256', $given)); }
function site_base(): string { return rtrim((string)(vh_cfg()['site_url'] ?? 'https://www.vedaheritage.co.in'), '/'); }

// ---------------------------------------------------------------- money
/** Split of a paid amount: our fee, GST on the fee, TCS/TDS held back, and what the partner receives. Throws if the fee exceeds the amount. */
function bk_breakdown(float $amount, array $fee, array $cfg): array {
    $f = bk_commission($amount, $fee); $gst = round($f * $cfg['gstRate'] / 100, 2);
    $tcs = round($amount * $cfg['tcsPercent'] / 100, 2); $tds = round($amount * $cfg['tdsPercent'] / 100, 2);
    $share = round($amount - $f - $gst - $tcs - $tds, 2);
    if ($share < 0) throw new RuntimeException('The fee and deductions are larger than the amount.');
    return ['amountInr' => round($amount, 2), 'feeInr' => $f, 'gstInr' => $gst, 'tcsInr' => $tcs, 'tdsInr' => $tds, 'partnerShareInr' => $share];
}

// ---------------------------------------------------------------- stays
/** Room units already taken for a night range by paid, confirmed or live-held bookings. */
function stay_taken(string $providerId, string $roomId, string $in, string $out, ?string $exceptId = null): int {
    $n = 0; $now = time();
    foreach (glob(bk_dir('items') . '/*.json') ?: [] as $f) {
        $b = json_file($f); if (!$b || ($b['kind'] ?? '') !== 'stay' || $b['providerId'] !== $providerId || ($b['roomId'] ?? '') !== $roomId || $b['id'] === $exceptId) continue;
        $live = in_array($b['status'], ['paid', 'confirmed'], true) || ($b['status'] === 'pay_pending' && ($b['holdUntil'] ?? 0) > $now);
        if ($live && $b['checkIn'] < $out && $b['checkOut'] > $in) $n++;
    }
    return $n;
}
function stay_nights(string $in, string $out): int { return (int)round((strtotime($out) - strtotime($in)) / 86400); }
/** Availability and price for one room, or an error string. */
function stay_quote(array $p, string $roomId, string $in, string $out, int $guests, ?string $exceptId = null) {
    $room = null; foreach (($p['inventory']['rooms'] ?? []) as $r) if (($r['id'] ?? '') === $roomId) $room = $r;
    if (!$room) return 'That room is not available.';
    $nights = stay_nights($in, $out); if ($nights < 1 || $nights > 30) return 'Stays are 1 to 30 nights.';
    if ($guests < 1 || $guests > (int)$room['capacity']) return 'This room sleeps ' . (int)$room['capacity'] . ' at most.';
    foreach (($p['inventory']['blocked'][$roomId] ?? []) as $d) if ($d >= $in && $d < $out) return 'The room is not available on some of those nights.';
    if (stay_taken($p['id'], $roomId, $in, $out, $exceptId) >= max(1, (int)($room['count'] ?? 1))) return 'The room is already booked for those nights.';
    return ['room' => $room, 'nights' => $nights, 'amountInr' => round($nights * (float)$room['rateInr'], 2)];
}

// ---------------------------------------------------------------- rides
function ride_km(string $a, string $b): ?float {
    if (!isset(RIDE_POINTS[$a], RIDE_POINTS[$b]) || $a === $b) return null;
    [$la1, $lo1] = [deg2rad(RIDE_POINTS[$a][2]), deg2rad(RIDE_POINTS[$a][3])]; [$la2, $lo2] = [deg2rad(RIDE_POINTS[$b][2]), deg2rad(RIDE_POINTS[$b][3])];
    $h = sin(($la2 - $la1) / 2) ** 2 + cos($la1) * cos($la2) * sin(($lo2 - $lo1) / 2) ** 2;
    return round(2 * 6371 * asin(min(1, sqrt($h))) * ROAD_FACTOR, 1);
}
/** Fare from a partner's rate card: base + per km, never below the minimum, plus a night surcharge (10pm to 5am). */
/** A pickup time from the form. Without a time zone it is India time (IST), because that is what travellers type. */
function ride_ts(string $when) { return strtotime(preg_match('/(Z|[+-]\d\d:?\d\d)$/', $when) ? $when : $when . ' +05:30'); }
function ride_fare(array $rate, float $km, int $ts): float {
    $fare = max((float)$rate['minInr'], (float)$rate['baseInr'] + $km * (float)$rate['perKmInr']);
    $h = (int)gmdate('G', $ts + 19800);   // India time
    if ($h >= 22 || $h < 5) $fare *= 1 + ((float)($rate['nightPct'] ?? 0)) / 100;
    return round($fare, 2);
}
/** Platform rate card (set in the admin, accepted by partners in their agreement): one card per vehicle type. */
function ride_rate(array $cfg, string $vehicle): ?array { $r = $cfg['rideRates'][$vehicle] ?? null; return is_array($r) ? $r : null; }
function ride_partners_for(string $district, string $vehicle): array {
    $o = []; foreach (bk_providers() as $p) if (($p['type'] ?? '') === 'transport' && bk_partner_ok($p) && in_array($district, $p['districts'] ?? [], true) && in_array($vehicle, $p['inventory']['vehicles'] ?? [], true)) $o[] = $p; return $o;
}
/** Sends the ride to every eligible partner with a private claim link. The first to claim it gets it. Returns how many were told. */
function ride_dispatch(array $b): int {
    $pts = RIDE_POINTS[$b['pickupId']]; $n = 0; $disp = [];
    foreach (ride_partners_for($pts[1], $b['vehicle']) as $p) {
        [$t, $h] = bk_token_new(); $disp[] = ['providerId' => $p['id'], 'tokenHash' => $h, 'sentOn' => gmdate('c')];
        $link = site_base() . '/driver/#id=' . $b['id'] . '&p=' . $p['id'] . '&t=' . $t;
        bk_mail($p['email'], 'Ride request ' . $b['ref'] . ': ' . $pts[0], "Ride request {$b['ref']}\n\nPickup: {$pts[0]}\nDrop: " . RIDE_POINTS[$b['dropId']][0] . "\nWhen: {$b['when']}\nVehicle: " . (RIDE_VEHICLES[$b['vehicle']] ?? $b['vehicle']) . "\nPassengers: {$b['guests']}\nFare" . (($b['payment']['mode'] ?? '') === 'online' ? ' (paid online to Veda Heritage; your share is released after the trip)' : ' (pay the driver on the trip)') . ": Rs {$b['amountInr']}\n\nFirst to accept gets the ride. Open this private link and enter the driver and vehicle details:\n$link\n\nVeda Heritage");
        $n++;
    }
    bk_locked($b['id'], function ($x) use ($disp) { $x['dispatch'] = $disp; $x['status'] = 'searching'; $x['dispatchedOn'] = gmdate('c'); return $x; });
    if (!$n) notify('Ride ' . $b['ref'] . ' has no partner', 'No partner covers this pickup and vehicle. Open Bookings in the admin to handle it.');
    return $n;
}

// ---------------------------------------------------------------- payments lifecycle
/** Creates (or returns) the Razorpay order for a booking, priced from our own record. Returns [order array] or an error string. */
function pay_order(string $id) {
    $out = null; $err = null;
    bk_locked($id, function ($b) use (&$out, &$err) {
        if (($b['payment']['mode'] ?? '') !== 'online' || !in_array($b['status'], ['pay_pending'], true)) { $err = 'This booking is not waiting for payment.'; return null; }
        if (($b['kind'] ?? '') === 'stay' && ($b['holdUntil'] ?? 0) < time()) { $err = 'The hold on these dates expired. Please book again.'; return null; }
        if (!empty($b['payment']['orderId'])) { $out = $b; return null; }
        [$code, $res] = rzp('POST', '/v1/orders', ['amount' => rzp_paise((float)$b['amountInr']), 'currency' => 'INR', 'receipt' => $b['ref'], 'notes' => ['ref' => $b['ref'], 'kind' => $b['kind']]]);
        if ($code >= 300 || empty($res['id'])) { $err = 'The payment service could not start the payment. Please try again.'; return null; }
        $b['payment']['orderId'] = $res['id']; $b['payment']['status'] = 'created'; $out = $b; return $b;
    });
    return $err ?? $out;
}
/** Marks a booking paid (idempotent), then moves the partner's share into a held transfer. Called by the verified checkout return AND the webhook. */
function pay_mark_paid(string $id, string $orderId, string $paymentId, int $paise): ?array {
    $first = false;
    $b = bk_locked($id, function ($b) use ($orderId, $paymentId, $paise, &$first) {
        if (($b['payment']['orderId'] ?? '') !== $orderId || rzp_paise((float)$b['amountInr']) !== $paise) return null;   // wrong order or amount: ignore
        if (in_array($b['payment']['status'] ?? '', ['paid', 'refunded'], true)) return null;
        $b['payment']['status'] = 'paid'; $b['payment']['paymentId'] = $paymentId; $b['payment']['paidOn'] = gmdate('c');
        $b['status'] = ($b['kind'] ?? '') === 'ride' ? 'paid' : 'confirmed'; $first = true; return $b;
    });
    if (!$b || !$first) return $b ?: bk_load($id);
    $b = pay_transfer($b);
    if (($b['kind'] ?? '') === 'ride') { ride_dispatch($b); $b = bk_load($id); }
    $pn = $b['providerName'] ?? ''; notify('Payment received ' . $b['ref'], "Rs {$b['amountInr']} paid for {$b['kind']} {$b['ref']} ($pn).");
    if (!empty($b['contactEmail'])) bk_mail($b['contactEmail'], 'Payment received for ' . $b['ref'], "Thank you. We received Rs {$b['amountInr']} for booking {$b['ref']}" . (($b['kind'] ?? '') === 'stay' ? " at $pn, {$b['checkIn']} to {$b['checkOut']}." : '. We are finding you a driver now and will email the driver details and your trip code.') . "\n\nQuote {$b['ref']} in any message.\n\nVeda Heritage");
    return $b;
}
/** Creates the held transfer of the partner's share from the captured payment (stays at once; rides when a driver claims). */
function pay_transfer(array $b): array {
    if (($b['payment']['status'] ?? '') !== 'paid' || !empty($b['payment']['transferId']) || empty($b['providerId']) || (($b['kind'] ?? '') === 'ride' && empty($b['driver']))) return $b;
    $p = json_file(market_dir('providers') . '/' . $b['providerId'] . '.json'); $acc = $p['inventory']['razorpayAccountId'] ?? '';
    if ($acc === '') { notify('Partner payout needs attention ' . $b['ref'], 'The partner has no Razorpay account ID, so the payout transfer was not created. Add it in Bookings.'); return $b; }
    [$code, $res] = rzp('POST', '/v1/payments/' . $b['payment']['paymentId'] . '/transfers', ['transfers' => [['account' => $acc, 'amount' => rzp_paise((float)$b['partnerShareInr']), 'currency' => 'INR', 'on_hold' => 1, 'notes' => ['ref' => $b['ref']]]]]);
    $tid = $res['items'][0]['id'] ?? ($res['id'] ?? '');
    if ($code >= 300 || $tid === '') { notify('Partner payout failed ' . $b['ref'], 'Razorpay did not create the transfer. Retry from Bookings.'); return $b; }
    return bk_locked($b['id'], function ($x) use ($tid) { $x['payment']['transferId'] = $tid; $x['payment']['payoutHeld'] = true; $x['settled'] = true; $x['settledRef'] = 'collected at payment'; $x['settledOn'] = gmdate('Y-m-d'); return $x; }) ?: $b;
}
/** Releases the held payout (after the stay or trip). */
function pay_release(string $id): array {
    $b = bk_load($id); if (!$b || empty($b['payment']['transferId'])) return [false, 'There is no payout to release.'];
    if (empty($b['payment']['payoutHeld'])) return [false, 'The payout was already released.'];
    [$code] = rzp('PATCH', '/v1/transfers/' . $b['payment']['transferId'], ['on_hold' => 0]);
    if ($code >= 300) return [false, 'Razorpay did not release the payout. Try again.'];
    bk_locked($id, function ($x) { $x['payment']['payoutHeld'] = false; $x['payment']['payoutReleasedOn'] = gmdate('Y-m-d'); return $x; });
    return [true, 'Payout released to the partner.'];
}
/** Refunds a paid booking (full, or part of it). The partner's transfer is reversed. */
function pay_refund(string $id, ?float $amount): array {
    $b = bk_load($id); if (!$b || ($b['payment']['status'] ?? '') !== 'paid') return [false, 'Only a paid booking can be refunded.'];
    $max = (float)$b['amountInr'] - (float)($b['payment']['refundedInr'] ?? 0); $amt = $amount ?? $max;
    if ($amt <= 0 || $amt > $max + 0.001) return [false, 'The refund must be more than 0 and at most Rs ' . $max . '.'];
    [$code, $res] = rzp('POST', '/v1/payments/' . $b['payment']['paymentId'] . '/refund', ['amount' => rzp_paise($amt), 'reverse_all' => 1, 'notes' => ['ref' => $b['ref']]]);
    if ($code >= 300 || empty($res['id'])) return [false, 'Razorpay did not accept the refund. Try again.'];
    $full = $amt >= $max - 0.001;
    bk_locked($id, function ($x) use ($amt, $full, $res) { $x['payment']['refundedInr'] = round((float)($x['payment']['refundedInr'] ?? 0) + $amt, 2); $x['payment']['refundId'] = $res['id']; if ($full) { $x['payment']['status'] = 'refunded'; $x['status'] = 'cancelled'; foreach (['contactEmail', 'contactPhone', 'message'] as $k) $x[$k] = ''; } return $x; });
    return [true, 'Refund of Rs ' . $amt . ' started. It reaches the traveller in a few days.'];
}
