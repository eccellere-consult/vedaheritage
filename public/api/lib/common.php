<?php
// Shared helpers for the public intake endpoints and the admin API. Include only; blocked over HTTP by .htaccess.
// Private data (seller and buyer contact details) lives in the data dir OUTSIDE public_html, never in GitHub.
if (!defined('VH_LIB')) define('VH_LIB', 1);

const MARKET_CATEGORIES = [
    'lamps-brassware' => 'Lamps & brassware', 'textiles' => 'Textiles & handloom', 'furniture-woodwork' => 'Furniture & woodwork',
    'art-crafts' => 'Art & crafts', 'musical-instruments' => 'Musical instruments', 'books-prints' => 'Books & prints', 'other-traditional' => 'Other traditional items',
];
const MARKET_CONDITIONS = ['new' => 'New / handmade', 'used' => 'Used'];
const MARKET_LISTING_DAYS = 90;
const MARKET_MAX_PRICE = 500000;

/** Where the settings file may live, best first. Always outside the web folder. */
function vh_cfg_candidates(): array {
    $c = [];
    if ($e = getenv('VH_CONFIG')) $c[] = $e;
    $c[] = dirname(__DIR__, 3) . '/vh-config.php';
    $dr = rtrim((string)($_SERVER['DOCUMENT_ROOT'] ?? ''), '/');
    if ($dr !== '') $c[] = dirname($dr) . '/vh-config.php';
    return array_values(array_unique($c));
}

/** Last three path parts, e.g. "domains/vedaheritage.co.in/vh-config.php" (no account or server names). */
function vh_short_path(string $p): string { return implode('/', array_slice(explode('/', trim($p, '/')), -3)); }

function vh_cfg(): array {
    static $c = null;
    if ($c !== null) return $c;
    $c = [];
    foreach (vh_cfg_candidates() as $path) {
        if (!is_file($path)) continue;
        $GLOBALS['vh_cfg_path'] = $path;
        try { $c = require $path; }
        catch (Throwable $e) { $GLOBALS['vh_cfg_error_line'] = (int)$e->getLine(); $c = []; } // a typing mistake must not crash the site
        break;
    }
    return is_array($c) ? $c : [];
}

/**
 * Whether a settings file was found, and where we looked (shortened). When it was not found, also value-free facts about
 * WHY: folder missing or blocked, a look-alike file name, or the file sitting one folder too far in or out.
 */
function vh_cfg_where(): array {
    vh_cfg();
    $found = !empty($GLOBALS['vh_cfg_path']);
    $out = ['found' => $found, 'looked' => array_map('vh_short_path', vh_cfg_candidates())];
    if (!$found) $out['diag'] = vh_cfg_diagnose();
    return $out;
}

/** Facts only (booleans and fixed look-alike names); never file contents, absolute paths or other file names. */
function vh_cfg_diagnose(): array {
    $first = vh_cfg_candidates()[0] ?? '';
    $dir = $first !== '' ? dirname($first) : '';
    $ob = (string)ini_get('open_basedir');
    $covers = null;
    if ($ob !== '' && $dir !== '') {
        $covers = false;
        foreach (explode(PATH_SEPARATOR, $ob) as $p) { $p = rtrim($p, '/'); if ($p !== '' && strpos($dir . '/', $p . '/') === 0) { $covers = true; break; } }
    }
    $h = $dir !== '' ? @opendir($dir) : false;
    $readable = $h !== false; if ($h) closedir($h);
    $similar = null;
    if ($readable) foreach (['vh-config.php.txt', 'vh_config.php', 'vh-config.PHP', 'Vh-config.php', 'vh-config.php.php', 'vh-config (1).php', 'vh-config.php ', 'vh-config.txt', 'vh-config'] as $v) {
        if (@file_exists($dir . '/' . $v)) { $similar = $v; break; }
    }
    $web = dirname(__DIR__, 2) . '/vh-config.php';      // inside the web folder: wrong, and never read
    $tooHigh = $dir !== '' ? dirname($dir) . '/vh-config.php' : '';
    return [
        'phpOk' => PHP_VERSION_ID >= 70400,
        'dirExists' => $dir !== '' && @is_dir($dir),
        'dirReadable' => $readable,
        'openBasedirSet' => $ob !== '',
        'openBasedirCoversDir' => $covers,
        'similarFile' => $similar,
        'fileInWebFolder' => @file_exists($web),
        'fileOneLevelTooHigh' => $tooHigh !== '' && @file_exists($tooHigh),
    ];
}

/** Line number of a syntax error in vh-config.php, or 0. (Never expose the message: it can quote a secret.) */
function vh_cfg_error_line(): int { vh_cfg(); return (int)($GLOBALS['vh_cfg_error_line'] ?? 0); }

function vh_data_dir(): string {
    $d = vh_cfg()['data_dir'] ?? (dirname(__DIR__, 3) . '/vh-data');
    if (!is_dir($d)) @mkdir($d, 0700, true);
    if (!is_dir($d) || !is_writable($d)) {
        $d = sys_get_temp_dir() . '/vh-data';
        if (!is_dir($d)) @mkdir($d, 0700, true);
    }
    return $d;
}

function market_dir(string $sub): string {
    $d = vh_data_dir() . '/market/' . $sub;
    if (!is_dir($d)) @mkdir($d, 0700, true);
    return $d;
}

function clean_text(?string $v, int $max): string {
    $v = trim(strip_tags((string)$v));
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $v) ?? '';
    return mb_substr($v, 0, $max);
}

function has_link(string $s): bool { return (bool)preg_match('~https?://|www\.|\b[a-z0-9-]+\.(com|in|net|org|co|io|me|ly)\b~i', $s); }

function new_id(): string { return gmdate('Ymd') . '-' . bin2hex(random_bytes(4)); }
function valid_id(string $s): bool { return (bool)preg_match('/^\d{8}-[0-9a-f]{8}$/', $s); }

function public_out(int $code, array $body): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($body);
    exit;
}

/** File-based limiter. $limit hits per $window seconds per IP and purpose. Returns false when over the limit. */
function rate_ok(string $purpose, int $limit, int $window): bool {
    $f = vh_data_dir() . '/rl-' . $purpose . '-' . hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? 'x') . '|vh') . '.json';
    $h = fopen($f, 'c+'); if (!$h) return true;
    flock($h, LOCK_EX);
    $hits = json_decode(stream_get_contents($h) ?: '[]', true); if (!is_array($hits)) $hits = [];
    $now = time(); $hits = array_values(array_filter($hits, fn($t) => $t > $now - $window));
    if (strpos($purpose, 'provider') === 0) $limit *= max(1, (int)(vh_cfg()['rate_scale'] ?? 1)); // tests only
    $ok = count($hits) < $limit;
    if ($ok) $hits[] = $now;
    ftruncate($h, 0); rewind($h); fwrite($h, json_encode($hits)); flock($h, LOCK_UN); fclose($h);
    return $ok;
}

function valid_email(string $s): bool { return (bool)filter_var($s, FILTER_VALIDATE_EMAIL) && strlen($s) <= 120; }
function normalise_phone(string $s): ?string {
    $d = preg_replace('/[^\d+]/', '', $s);
    return preg_match('/^\+?\d{8,15}$/', $d) ? $d : null;
}

/** Re-encode an uploaded image as a bounded JPEG (strips EXIF/GPS). Returns bytes or null. */
function reencode_jpeg(string $tmp, int $maxEdge = 1200): ?string {
    if (!function_exists('imagecreatefromstring')) return null;
    $info = @getimagesize($tmp);
    if (!$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) return null;
    if ($info[0] * $info[1] > 40000000) return null;
    $img = @imagecreatefromstring((string)file_get_contents($tmp));
    if (!$img) return null;
    if (max(imagesx($img), imagesy($img)) > $maxEdge) {
        $scaled = imagesx($img) >= imagesy($img) ? imagescale($img, $maxEdge) : imagescale($img, (int)round(imagesx($img) * $maxEdge / imagesy($img)), $maxEdge);
        if ($scaled) { imagedestroy($img); $img = $scaled; }
    }
    ob_start(); imagejpeg($img, null, 80); $jpg = ob_get_clean(); imagedestroy($img);
    return $jpg ?: null;
}

/** Words that need a human to look twice (not an automatic rejection). */
function market_flags(string $text): array {
    $rules = [
        '/\b(ivory|tusk|horn|antler|bone|shell|coral|feather|fur|skin|leather|tiger|elephant|pangolin)\b/i' => 'Mentions animal material (check wildlife law)',
        '/\b(sandal ?wood|rose ?wood|red sanders|teak ?log|timber)\b/i' => 'Mentions regulated timber',
        '/\b(antique|antiquity|century|centuries|vintage|heirloom|old temple|palm[- ]?leaf|manuscript|ola)\b/i' => 'May be an antiquity (100 years; manuscripts 75): check age',
        '/\b(idol|vigraha|murti|deity|temple (item|piece|lamp))\b/i' => 'Religious idol or temple item (check provenance)',
        '/\b(medicine|medicinal|ayurvedic (oil|tablet|kit)|cure|treats?|herbal (oil|powder)|tablet|capsule|churna|lehyam)\b/i' => 'Health or medicine claim (not allowed)',
        '/\b(seed|seeds|sapling|plant|live)\b/i' => 'Live plant or seed (not allowed in v1)',
        '/\b(gold|silver|diamond|gemstone|hallmark)\b/i' => 'Precious metal or stone (check hallmarking)',
        '/\b(gi tag|genuine|authentic|certified|original aranmula)\b/i' => 'Authenticity claim (cannot be verified)',
        '/\b(advance|western union|gift card|crypto|upi first)\b/i' => 'Payment request pattern (scam risk)',
    ];
    $out = [];
    foreach ($rules as $re => $msg) if (preg_match($re, $text)) $out[] = $msg;
    return $out;
}

/** Hard blockers for a stored submission. Mirrors scripts/validate-content.mjs for listings. */
function listing_blockers(array $s): array {
    $b = [];
    if (!isset(MARKET_CATEGORIES[$s['category'] ?? ''])) $b[] = 'Unknown category.';
    if (!isset(MARKET_CONDITIONS[$s['condition'] ?? ''])) $b[] = 'Unknown condition.';
    $p = $s['priceInr'] ?? null;
    if (!is_int($p) || $p < 1 || $p > MARKET_MAX_PRICE) $b[] = 'Price must be a whole number of rupees between 1 and ' . MARKET_MAX_PRICE . '.';
    $t = (string)($s['title'] ?? ''); if (mb_strlen($t) < 5 || mb_strlen($t) > 90) $b[] = 'Title must be 5 to 90 characters.';
    $d = (string)($s['description'] ?? ''); if (mb_strlen($d) < 40 || mb_strlen($d) > 1500) $b[] = 'Description must be 40 to 1500 characters.';
    if (trim((string)($s['district'] ?? '')) === '') $b[] = 'District is missing.';
    if (trim((string)($s['sellerName'] ?? '')) === '') $b[] = 'Seller name is missing.';
    if (count($s['photos'] ?? []) < 1) $b[] = 'At least 1 photo is required.';
    if (empty($s['declared'])) $b[] = 'The seller declaration is missing.';
    return $b;
}

/** Sends mail, or appends it to a file when 'mail_outbox' is configured (used by tests). */
function send_mail(string $to, string $subject, string $body): bool {
    $box = vh_cfg()['mail_outbox'] ?? '';
    if ($box) return @file_put_contents($box, json_encode(['to' => $to, 'subject' => $subject, 'body' => $body]) . "\n", FILE_APPEND | LOCK_EX) !== false;
    return @mail($to, $subject, $body, 'Content-Type: text/plain; charset=utf-8');
}

function notify(string $subject, string $body): void {
    $to = vh_cfg()['notify_email'] ?? '';
    if ($to) send_mail($to, $subject, $body);
}

function json_file(string $path): ?array {
    if (!is_file($path)) return null;
    $d = json_decode((string)file_get_contents($path), true);
    return is_array($d) ? $d : null;
}
function save_json(string $path, array $data): void {
    @file_put_contents($path, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), LOCK_EX);
}


// ---------------------------------------------------------------- service-provider directory
const DISTRICTS = ['Thiruvananthapuram', 'Kollam', 'Pathanamthitta', 'Alappuzha', 'Kottayam', 'Idukki', 'Ernakulam', 'Thrissur', 'Palakkad', 'Malappuram', 'Kozhikode', 'Wayanad', 'Kannur', 'Kasaragod'];
/** type => [label, credential required, may be sponsored]. Wellness is organic-only: health advertising is regulated. */
const PROVIDER_TYPES = [
    'guide'      => ['Guides & local experts', true, true],
    'transport'  => ['Taxi, auto & transport', false, true],
    'stay'       => ['Stays & homestays', true, true],
    'wellness'   => ['Ayurveda & wellness centres', true, false],
    'crafts'     => ['Crafts & shops', false, true],
    'food'       => ['Restaurants & food', false, true],
    'learning'   => ['Music, dance & Vedic classes', false, true],
    'travel-desk' => ['Tour operators & travel desks', true, true],
];
const SPONSOR_MAX_DAYS = 90;
const SPONSOR_MAX_PER_DISTRICT_TYPE = 3;
const REVERIFY_DAYS = 365;

/** Claims a human must look at (organic text). */
function provider_flags(string $text): array {
    $rules = [
        '/\b(best|no\.? ?1|number one|#1|top[- ]rated|finest|greatest|unbeatable|world[- ]class|leading)\b/i' => 'Superlative or ranking claim',
        '/\b(cheapest|lowest price|guaranteed?|100 ?%|risk[- ]free|money[- ]back|free of cost)\b/i' => 'Price or guarantee claim',
        '/\b(cure[sd]?|treats?|heals?|remed(y|ies)|therapeutic|diseases?|diabetes|cancer|arthritis|infertility)\b/i' => 'Health claim (not allowed)',
        '/\b(authentic|genuine|original|certified|licensed|approved by|government (approved|recognised))\b/i' => 'Authenticity or approval claim (check the credential)',
        '/\b(miracle|secret|magic|spell|black magic|vashikaran)\b/i' => 'Miracle or occult claim',
        '/\b(whatsapp me|dm me|click here|limited offer|hurry|act now)\b/i' => 'Pressure or spam wording',
    ];
    $out = [];
    foreach ($rules as $re => $msg) if (preg_match($re, $text)) $out[] = $msg;
    if (preg_match('/[A-Z]{6,}.*[A-Z]{6,}/', $text) && strtoupper($text) === $text) $out[] = 'All capitals';
    return $out;
}

/** Checks an https website: reachable, certificate OK, where it ends up. */
function website_check(string $url): array {
    $insecure = !empty(vh_cfg()['insecure_checks']); // tests only: allow http to a local server
    if (!preg_match($insecure ? '~^https?://~i' : '~^https://~i', $url)) return ['ok' => false, 'status' => 0, 'error' => 'Not an https address'];
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_NOBODY => false, CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 3, CURLOPT_TIMEOUT => 8, CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_USERAGENT => 'vedaheritage-verifier', CURLOPT_RANGE => '0-2048']);
    $body = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); $final = (string)curl_getinfo($ch, CURLINFO_EFFECTIVE_URL); $err = curl_error($ch); curl_close($ch);
    $h1 = strtolower(preg_replace('/^www\./', '', (string)parse_url($url, PHP_URL_HOST))); $h2 = strtolower(preg_replace('/^www\./', '', (string)parse_url($final, PHP_URL_HOST)));
    return ['ok' => $body !== false && $code >= 200 && $code < 400, 'status' => $code, 'finalHost' => $h2, 'sameHost' => $h1 === $h2, 'error' => $err ?: null];
}

function url_ok(string $u): bool {
    $insecure = !empty(vh_cfg()['insecure_checks']);
    if (!preg_match($insecure ? '~^https?://[^\s]+$~i' : '~^https://[^\s]+$~i', $u) || strlen($u) > 200) return false;
    return !preg_match('~//(bit\.ly|tinyurl\.com|t\.co|goo\.gl|wa\.me|linktr\.ee|rb\.gy)/~i', $u);
}

function email_domain(string $e): string { return strtolower(substr(strrchr($e, '@') ?: '', 1)); }
function host_of(string $u): string { return strtolower(preg_replace('/^www\./', '', (string)parse_url($u, PHP_URL_HOST))); }

/** Fields every provider submission must have, and what must be true before it is published. */
function provider_blockers(array $s, array $checks, ?array $site): array {
    $b = [];
    $t = PROVIDER_TYPES[$s['type'] ?? ''] ?? null;
    if (!$t) $b[] = 'Unknown provider type.';
    if (empty($s['emailVerified']) && empty($checks['emailManual'])) $b[] = 'The business email is not verified (the owner has not clicked the link; tick "verified by other means" only if you have confirmed it).';
    if (empty($checks['phone'])) $b[] = 'Confirm that you called or messaged the business phone number.';
    if ($t && $t[1]) {
        if (empty($s['credentialKind'])) $b[] = 'This type needs a registration or licence description.';
        if (empty($checks['credential'])) $b[] = 'Confirm that you checked the credential against the official register.';
    }
    if (!empty($s['website']) && !($site['ok'] ?? false)) $b[] = 'The website did not respond properly (status ' . ($site['status'] ?? 0) . ').';
    return $b;
}

function provider_public(array $s, string $today): array {
    $out = [
        'id' => $s['id'], 'name' => $s['name'], 'type' => $s['type'], 'districts' => $s['districts'], 'summary' => $s['summary'],
        'phone' => $s['phone'], 'email' => $s['email'], 'verifiedOn' => $today, 'reverifyBy' => gmdate('Y-m-d', strtotime($today) + REVERIFY_DAYS * 86400), 'status' => 'approved',
    ];
    if (!empty($s['website'])) $out['website'] = $s['website'];
    if (!empty($s['address'])) $out['address'] = $s['address'];
    if (!empty($s['credentialKind'])) $out['credentialLabel'] = $s['credentialKind'];
    return $out;
}

/** Count of OTHER sponsored providers in the same district and type whose window overlaps [from, until]. Returns the worst district. */
function sponsor_cap_hit(array $cand, array $others): ?string {
    foreach ($cand['districts'] as $d) {
        $n = 0;
        foreach ($others as $o) {
            if (($o['id'] ?? '') === $cand['id'] || ($o['type'] ?? '') !== $cand['type'] || ($o['status'] ?? '') !== 'approved' || empty($o['sponsored'])) continue;
            if (!in_array($d, $o['districts'] ?? [], true)) continue;
            if ($o['sponsored']['from'] <= $cand['sponsored']['until'] && $o['sponsored']['until'] >= $cand['sponsored']['from']) $n++;
        }
        if ($n >= SPONSOR_MAX_PER_DISTRICT_TYPE) return $d;
    }
    return null;
}
