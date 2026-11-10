<?php
// Partner portal API: a stay or transport partner signs in with an emailed link (no password) and manages its own rides, bookings,
// rooms and vehicles. One endpoint: /api/partner.php?a=<action>. Sessions are stored hashed in the private data folder.
define('VH_LIB', 1);
require __DIR__ . '/lib/commerce.php';

$a = preg_replace('/[^a-z_]/', '', $_GET['a'] ?? '');
$post = ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST';
$in = $post ? (json_decode((string)file_get_contents('php://input'), true) ?: []) : [];
$err = fn(string $m, int $c = 422) => public_out($c, ['ok' => false, 'error' => $m]);
$portalOpen = fn() => bk_open('enquiries') || bk_open('stays') || bk_open('rides');
function partner_dir(string $sub): string { return bk_dir('partner/' . $sub); }

// ---- sign in: ask for an emailed link. Always answers the same, so nobody can discover which emails are partners.
if ($a === 'login' && $post) {
    if (!rate_ok('booking-partner-login', 5, 3600)) $err('Too many attempts. Please try again later.', 429);
    $email = strtolower(trim((string)($in['email'] ?? '')));
    if (valid_email($email) && $portalOpen()) {
        foreach (bk_providers() as $p) if (strtolower($p['email'] ?? '') === $email && bk_partner_ok($p)) {
            [$t, $h] = bk_token_new();
            save_json(partner_dir('logins') . "/$h.json", ['providerId' => $p['id'], 'expires' => time() + 1200]);
            bk_mail($email, 'Your Veda Heritage partner sign-in link', "Hello,\n\nOpen this link to sign in to the partner page. It works once and expires in 20 minutes:\n\n" . site_base() . "/partner/#t=$t\n\nIf you did not ask for this, ignore this email.\n\nVeda Heritage");
            break;
        }
    }
    public_out(200, ['ok' => true, 'message' => 'If that email belongs to a partner, a sign-in link is on its way.']);
}
// ---- exchange the emailed link for a session
if ($a === 'session' && $post) {
    if (!rate_ok('booking-partner-login', 20, 3600)) $err('Too many attempts. Please try again later.', 429);
    $h = hash('sha256', (string)($in['token'] ?? '')); $f = partner_dir('logins') . "/$h.json"; $l = json_file($f);
    if (!$l || ($l['expires'] ?? 0) < time()) $err('This sign-in link has expired or was already used. Ask for a new one.', 401);
    @unlink($f);
    [$t, $sh] = bk_token_new();
    save_json(partner_dir('sessions') . "/$sh.json", ['providerId' => $l['providerId'], 'expires' => time() + 14 * 86400]);
    public_out(200, ['ok' => true, 'session' => $t]);
}

// ---- everything below needs a session
$tok = (string)($_SERVER['HTTP_X_PARTNER_TOKEN'] ?? '');
$sf = $tok !== '' ? partner_dir('sessions') . '/' . hash('sha256', $tok) . '.json' : '';
$sess = $sf ? json_file($sf) : null;
if (!$sess || ($sess['expires'] ?? 0) < time()) $err('Please sign in again.', 401);
if (!rate_ok('booking-partner-api', 600, 3600)) $err('Too many requests. Please wait a little.', 429);
$pid = $sess['providerId']; $ppath = market_dir('providers') . "/$pid.json"; $p = json_file($ppath);
if (!$p || !bk_partner_ok($p)) $err('Your partner account is not active. Contact Veda Heritage.', 403);
if (!$portalOpen()) $err('The partner page is not open yet.', 403);

if ($a === 'logout' && $post) { @unlink($sf); public_out(200, ['ok' => true]); }

$mine = function () use ($pid) { $o = []; foreach (glob(bk_dir('items') . '/*.json') ?: [] as $f) { $b = json_file($f); if ($b && ($b['providerId'] ?? '') === $pid) $o[] = $b; } usort($o, fn($x, $y) => strcmp($y['created'], $x['created'])); return $o; };

if ($a === 'me') {
    public_out(200, ['ok' => true, 'testMode' => bk_test(), 'partner' => ['name' => $p['name'], 'type' => $p['type'], 'typeLabel' => PROVIDER_TYPES[$p['type']][0] ?? $p['type'], 'districts' => $p['districts']],
        'inventory' => ['rooms' => $p['inventory']['rooms'] ?? [], 'blocked' => (object)($p['inventory']['blocked'] ?? []), 'vehicles' => $p['inventory']['vehicles'] ?? []], 'vehicles' => RIDE_VEHICLES, 'payoutAccountSet' => !empty($p['inventory']['razorpayAccountId']),
        'caps' => ['stays' => bk_open('stays'), 'rides' => bk_open('rides'), 'enquiries' => bk_open('enquiries')]]);
}
if ($a === 'overview') {
    $open = []; $rides = []; $stays = [];
    foreach (glob(bk_dir('items') . '/*.json') ?: [] as $f) {
        $b = json_file($f); if (!$b) continue;
        if (($b['kind'] ?? '') === 'ride' && ($b['status'] ?? '') === 'searching' && array_filter($b['dispatch'] ?? [], fn($d) => ($d['providerId'] ?? '') === $pid)) $open[] = ride_view($b, $pid);
    }
    foreach ($mine() as $b) {
        $pay = $b['payment'] ?? null;
        $row = ['id' => $b['id'], 'ref' => $b['ref'], 'kind' => $b['kind'] ?? 'enquiry', 'status' => $b['status'], 'test' => !empty($b['test']), 'created' => $b['created'], 'checkIn' => $b['checkIn'] ?? '', 'checkOut' => $b['checkOut'] ?? '', 'people' => $b['people'] ?? 0,
            'name' => $b['name'] ?? '', 'phone' => $b['contactPhone'] ?? '', 'email' => $b['contactEmail'] ?? '', 'message' => $b['message'] ?? '', 'roomName' => $b['roomName'] ?? '', 'amountInr' => $b['amountInr'] ?? ($b['valueInr'] ?? null),
            'paid' => ($pay['status'] ?? '') === 'paid', 'online' => ($pay['mode'] ?? '') === 'online', 'payoutHeld' => !empty($pay['payoutHeld']), 'partnerShareInr' => $b['partnerShareInr'] ?? null, 'feeInr' => $b['feeInr'] ?? null, 'gstInr' => $b['gstInr'] ?? null];
        if (($b['kind'] ?? '') === 'ride') $rides[] = ride_view($b, $pid) + ['partnerShareInr' => $row['partnerShareInr'], 'paid' => $row['paid'], 'payoutHeld' => $row['payoutHeld'], 'rideName' => $b['name'] ?? '', 'ridePhone' => $b['contactPhone'] ?? ''];
        else $stays[] = $row;
    }
    public_out(200, ['ok' => true, 'openRides' => $open, 'rides' => array_slice($rides, 0, 60), 'bookings' => array_slice($stays, 0, 100)]);
}
if ($a === 'claim' && $post) {
    $id = (string)($in['id'] ?? ''); $b = bk_load($id);
    if (!$b || ($b['kind'] ?? '') !== 'ride' || !array_filter($b['dispatch'] ?? [], fn($d) => ($d['providerId'] ?? '') === $pid)) $err('This ride is not available to you.', 404);
    [$x, $e] = ride_claim_do($id, $p, (string)($in['driverName'] ?? ''), (string)($in['driverPhone'] ?? ''), (string)($in['vehicleNo'] ?? ''));
    if (!$x) $err($e, strpos($e, 'already') !== false ? 409 : 422);
    public_out(200, ['ok' => true, 'message' => 'The ride is yours. The traveller was sent your details and a trip code.']);
}
if ($a === 'trip' && $post) {
    [$ok, $m] = ride_trip_do((string)($in['id'] ?? ''), $pid, (string)($in['action'] ?? ''), (string)($in['otp'] ?? ''));
    if (!$ok) $err($m); public_out(200, ['ok' => true, 'message' => $m]);
}
if ($a === 'respond' && $post) {
    $id = (string)($in['id'] ?? ''); $dec = (string)($in['decision'] ?? ''); $b = bk_load($id);
    if (!$b || ($b['providerId'] ?? '') !== $pid || ($b['kind'] ?? '') === 'ride' || !in_array($dec, ['confirm', 'decline'], true)) $err('Not found.', 404);
    if (($b['payment']['mode'] ?? '') === 'online' || !in_array($b['status'], ['new', 'sent'], true)) $err('This booking cannot be changed here. Contact Veda Heritage.');
    bk_locked($id, function ($x) use ($dec) { $x['status'] = $dec === 'confirm' ? 'confirmed' : 'declined'; $x['respondedOn'] = gmdate('c'); if ($dec === 'decline') foreach (['contactEmail', 'contactPhone', 'message'] as $k) $x[$k] = ''; return $x; });
    notify('Partner ' . ($dec === 'confirm' ? 'confirmed' : 'declined') . ' ' . $b['ref'], $p['name'] . ' ' . $dec . 'ed booking request ' . $b['ref'] . '.');
    public_out(200, ['ok' => true, 'message' => $dec === 'confirm' ? 'Confirmed. Please contact the traveller to finalise.' : 'Declined.']);
}
if ($a === 'inventory_save' && $post) {
    [$inv, $e] = bk_inventory_apply($p, $in, false); if ($e) $err($e, 400);
    $p['inventory'] = $inv; save_json($ppath, $p); public_out(200, ['ok' => true, 'message' => 'Saved. New bookings use these rates and dates.']);
}
$err('Unknown action.', 404);
