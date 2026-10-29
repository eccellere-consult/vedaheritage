<?php
// Admin API library (included by index.php only). PHP 7.4+ compatible.
// Secrets live in /domains/<site>/vh-config.php OUTSIDE the web folder:
//   <?php return [
//     'admin_github_token'  => 'github_pat_...',   // fine-grained, this repo only (falls back to github_token)
//     'repo'                => 'owner/name',
//     'admin_password_hash' => '$2y$...',          // made by the one-time setup form
//     'allowed_ips'         => [],                  // optional: ['203.0.113.7']
//   ];
if (!defined('VH_ADMIN')) { http_response_code(404); exit; }

const SESSION_IDLE = 1800;     // log out after 30 minutes idle
const SESSION_MAX  = 28800;    // and after 8 hours regardless
const CATS = ['temples', 'places', 'beaches', 'backwaters', 'heritage', 'ayurveda'];

ini_set('display_errors', '0');

// ---------------------------------------------------------------- config / io
function cfg(): array {
    static $c = null;
    if ($c !== null) return $c;
    $path = getenv('VH_CONFIG') ?: dirname(__DIR__, 3) . '/vh-config.php';
    $c = is_file($path) ? require $path : [];
    return is_array($c) ? $c : [];
}

function data_dir(): string {
    $d = cfg()['data_dir'] ?? (dirname(__DIR__, 3) . '/vh-data');
    if (!is_dir($d)) @mkdir($d, 0700, true);
    if (!is_dir($d) || !is_writable($d)) {
        $d = sys_get_temp_dir() . '/vh-data';
        if (!is_dir($d)) @mkdir($d, 0700, true);
    }
    return $d;
}

function json_out(int $code, array $body): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Robots-Tag: noindex, nofollow');
    header('X-Frame-Options: DENY');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: no-referrer');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function read_json(): array {
    $raw = file_get_contents('php://input', false, null, 0, 65536);
    $d = json_decode($raw ?: '', true);
    return is_array($d) ? $d : [];
}

function client_ip(): string { return $_SERVER['REMOTE_ADDR'] ?? 'unknown'; }

function audit(string $event, array $ctx = []): void {
    $line = json_encode(['t' => gmdate('c'), 'ip' => client_ip(), 'e' => $event] + $ctx, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n";
    @file_put_contents(data_dir() . '/admin-audit.log', $line, FILE_APPEND | LOCK_EX);
}

// ---------------------------------------------------------------- login throttle
function throttle_update(callable $fn) {
    $f = fopen(data_dir() . '/login-throttle.json', 'c+');
    if (!$f) return null;
    flock($f, LOCK_EX);
    $raw = stream_get_contents($f);
    $s = json_decode($raw ?: '', true);
    if (!is_array($s)) $s = ['ip' => [], 'global' => ['fails' => [], 'until' => 0]];
    $now = time();
    $out = $fn($s, $now);
    ftruncate($f, 0); rewind($f);
    fwrite($f, json_encode($s));
    flock($f, LOCK_UN); fclose($f);
    return $out;
}

/** Seconds the caller must wait, or 0. 5 fails/IP or 25 fails overall in 15 min lock logins for 15 min. */
function throttle_locked(): int {
    return (int)throttle_update(function (&$s, $now) {
        $ip = client_ip();
        $a = $s['ip'][$ip]['until'] ?? 0;
        $b = $s['global']['until'] ?? 0;
        return max(0, $a - $now, $b - $now);
    });
}
function throttle_fail(): void {
    throttle_update(function (&$s, $now) {
        $ip = client_ip();
        $e = $s['ip'][$ip] ?? ['fails' => [], 'until' => 0];
        $e['fails'] = array_values(array_filter($e['fails'], fn($t) => $t > $now - 900)); $e['fails'][] = $now;
        if (count($e['fails']) >= 5) { $e['until'] = $now + 900; $e['fails'] = []; }
        $s['ip'][$ip] = $e;
        $g = $s['global'];
        $g['fails'] = array_values(array_filter($g['fails'], fn($t) => $t > $now - 900)); $g['fails'][] = $now;
        if (count($g['fails']) >= 25) { $g['until'] = $now + 900; $g['fails'] = []; }
        $s['global'] = $g;
        return null;
    });
}
function throttle_reset(): void {
    throttle_update(function (&$s, $now) { unset($s['ip'][client_ip()]); return null; });
}

// ---------------------------------------------------------------- session / auth
function start_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $https = !empty($_SERVER['HTTPS']) || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name('vh_admin');
    session_set_cookie_params([
        'lifetime' => 0, 'path' => '/', 'secure' => $https && empty(cfg()['insecure_cookies']),
        'httponly' => true, 'samesite' => 'Strict',
    ]);
    session_start();
}

function ip_allowed(): bool {
    $allow = cfg()['allowed_ips'] ?? [];
    return !$allow || in_array(client_ip(), $allow, true);
}

function is_authed(): bool {
    start_session();
    if (empty($_SESSION['ok'])) return false;
    $now = time();
    if (($now - ($_SESSION['seen'] ?? 0)) > SESSION_IDLE || ($now - ($_SESSION['born'] ?? 0)) > SESSION_MAX) {
        $_SESSION = []; session_destroy(); return false;
    }
    $_SESSION['seen'] = $now;
    return ip_allowed();
}

function require_auth(bool $write): void {
    if (!is_authed()) json_out(401, ['error' => 'Please log in.']);
    if ($write) {
        $host = $_SERVER['HTTP_HOST'] ?? '';
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        if ($origin !== '' && parse_url($origin, PHP_URL_HOST) . (parse_url($origin, PHP_URL_PORT) ? ':' . parse_url($origin, PHP_URL_PORT) : '') !== $host) {
            audit('blocked-origin', ['origin' => $origin]); json_out(403, ['error' => 'Cross-site request blocked.']);
        }
        $tok = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if (!$tok || !hash_equals((string)($_SESSION['csrf'] ?? ''), $tok)) json_out(403, ['error' => 'Session expired. Reload the page.']);
    }
}

// ---------------------------------------------------------------- GitHub
function repo(): string {
    $r = cfg()['repo'] ?? '';
    if (!preg_match('~^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$~', $r)) throw new RuntimeException('Server is not configured (repo).');
    return $r;
}

/** @return array [int status, mixed data] */
function gh(string $method, string $path, ?array $body = null, array $query = []): array {
    $token = cfg()['admin_github_token'] ?? (cfg()['github_token'] ?? '');
    if (!$token) throw new RuntimeException('Server is not configured (GitHub token).');
    $base = rtrim(cfg()['github_api'] ?? 'https://api.github.com', '/');
    $url = $base . $path . ($query ? '?' . http_build_query($query) : '');
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 25,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token, 'Accept: application/vnd.github+json', 'X-GitHub-Api-Version: 2022-11-28', 'User-Agent: vedaheritage-admin', 'Content-Type: application/json'],
    ]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    $raw = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if ($raw === false) throw new RuntimeException('Could not reach GitHub: ' . $err);
    $data = json_decode($raw, true);
    return [$code, $data];
}

function gh_ok(array $r, string $what): array {
    if ($r[0] < 200 || $r[0] >= 300) {
        $msg = is_array($r[1]) ? ($r[1]['message'] ?? 'error') : 'error';
        throw new RuntimeException("GitHub refused ($what): $msg");
    }
    return is_array($r[1]) ? $r[1] : [];
}

function gh_file(string $path, string $ref): ?array {
    [$c, $d] = gh('GET', '/repos/' . repo() . '/contents/' . $path, null, ['ref' => $ref]);
    if ($c === 404) return null;
    gh_ok([$c, $d], 'read file');
    return ['sha' => $d['sha'], 'text' => base64_decode(str_replace("\n", '', $d['content'] ?? '')) ?: ''];
}

// ---------------------------------------------------------------- tiny cache
function cache_get(string $k, int $ttl) {
    $f = data_dir() . '/cache-' . md5($k) . '.json';
    if (is_file($f) && filemtime($f) > time() - $ttl) return json_decode((string)file_get_contents($f), true);
    return null;
}
function cache_put(string $k, $v): void { @file_put_contents(data_dir() . '/cache-' . md5($k) . '.json', json_encode($v), LOCK_EX); }
function cache_clear(): void { foreach (glob(data_dir() . '/cache-*.json') ?: [] as $f) @unlink($f); }

// ---------------------------------------------------------------- entries
function valid_slug(string $s): bool { return (bool)preg_match('/^[a-z0-9][a-z0-9-]{0,79}$/', $s); }

/** Hard blockers (publishing is refused) for a draft entry. Mirrors scripts/validate-content.mjs essentials. */
function publish_blockers(array $e): array {
    $b = [];
    if (($e['status'] ?? '') !== 'draft') $b[] = 'Entry is not a draft.';
    $imgs = $e['images'] ?? [];
    if (!is_array($imgs) || count($imgs) < 1) $b[] = 'Needs at least 1 licensed, credited image (use "Find images").';
    else foreach ($imgs as $im) foreach (['src', 'alt', 'credit', 'license', 'sourceUrl'] as $f) if (empty($im[$f])) { $b[] = "An image is missing its $f."; break 2; }
    $src = $e['sources'] ?? [];
    $okSrc = array_filter(is_array($src) ? $src : [], fn($s) => is_array($s) && !empty($s['label']) && preg_match('~^https://~', $s['url'] ?? ''));
    if (count($okSrc) < 2) $b[] = 'Needs at least 2 sources.';
    $sum = (string)($e['summary'] ?? '');
    if (strlen($sum) < 50 || strlen($sum) > 200) $b[] = 'Summary must be 50 to 200 characters.';
    foreach (['folklore', 'history', 'spiritual', 'visitorInfo'] as $k) if (empty($e[$k])) $b[] = "Missing section: $k.";
    return $b;
}

function evidence_summary(?array $ev): ?array {
    if (!$ev || empty($ev['verification'])) return null;
    $v = $ev['verification'];
    $count = ['supported' => 0, 'partly_supported' => 0, 'contradicted' => 0, 'unverifiable' => 0];
    foreach ($v['results'] ?? [] as $r) { $k = $r['verdict'] ?? ''; if (isset($count[$k])) $count[$k]++; }
    return [
        'score' => $v['score'] ?? null, 'recommendation' => $v['recommendation'] ?? null,
        'gateReasons' => $v['gateReasons'] ?? [], 'counts' => $count,
        'issues' => array_values(array_filter($v['issues'] ?? [], fn($i) => ($i['severity'] ?? '') !== 'minor')),
        'folkloreAssessment' => $v['folkloreAssessment'] ?? '', 'sensitivityAssessment' => $v['sensitivityAssessment'] ?? '',
        'model' => $ev['model'] ?? '', 'date' => $ev['date'] ?? '',
    ];
}

function draft_row(array $e, ?array $ev, array $where): array {
    return [
        'slug' => $e['slug'] ?? '', 'category' => $e['category'] ?? '', 'name' => $e['name'] ?? '', 'district' => $e['district'] ?? '',
        'status' => $e['status'] ?? '', 'where' => $where, 'images' => count($e['images'] ?? []), 'sources' => count($e['sources'] ?? []),
        'blockers' => publish_blockers($e), 'verification' => evidence_summary($ev),
    ];
}
