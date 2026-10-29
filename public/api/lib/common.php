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

function vh_cfg(): array {
    static $c = null;
    if ($c !== null) return $c;
    $path = getenv('VH_CONFIG') ?: dirname(__DIR__, 3) . '/vh-config.php';
    $c = is_file($path) ? require $path : [];
    return is_array($c) ? $c : [];
}

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

function notify(string $subject, string $body): void {
    $to = vh_cfg()['notify_email'] ?? '';
    if ($to) @mail($to, $subject, $body, 'Content-Type: text/plain; charset=utf-8');
}

function json_file(string $path): ?array {
    if (!is_file($path)) return null;
    $d = json_decode((string)file_get_contents($path), true);
    return is_array($d) ? $d : null;
}
function save_json(string $path, array $data): void {
    @file_put_contents($path, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), LOCK_EX);
}
