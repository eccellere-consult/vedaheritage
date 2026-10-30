<?php
// Admin API router. One endpoint: /api/admin/?a=<action>. JSON in, JSON out.
// Reads are GET, writes are POST with the session CSRF token. See docs/ADMIN.md.
define('VH_ADMIN', 1);
require __DIR__ . '/lib.php';

$a = preg_replace('/[^a-z_]/', '', $_GET['a'] ?? '');
$method = $_SERVER['REQUEST_METHOD'];
$in = $method === 'POST' ? read_json($a === 'photo_upload' ? 2600000 : 65536) : [];

function need_str(array $in, string $k, int $max = 200): string {
    $v = $in[$k] ?? '';
    if (!is_string($v) || $v === '' || strlen($v) > $max) json_out(400, ['error' => "Missing or invalid: $k"]);
    return $v;
}
function need_int(array $in, string $k): int {
    $v = $in[$k] ?? null;
    if (!is_int($v) || $v < 1) json_out(400, ['error' => "Missing or invalid: $k"]);
    return $v;
}

/** Content files on main: [['cat','slug','path','sha'], ...] plus evidence shas by slug. */
function tree_index(): array {
    $c = cache_get('tree', 60);
    if ($c) return $c;
    $t = gh_ok(gh('GET', '/repos/' . repo() . '/git/trees/main', null, ['recursive' => '1']), 'read tree');
    $entries = []; $evidence = []; $providers = [];
    $cats = implode('|', CATS);
    foreach ($t['tree'] ?? [] as $n) {
        if (($n['type'] ?? '') !== 'blob') continue;
        if (preg_match('~^src/content/(' . $cats . ')/([a-z0-9-]+)\.json$~', $n['path'], $m)) $entries[] = ['cat' => $m[1], 'slug' => $m[2], 'path' => $n['path'], 'sha' => $n['sha']];
        elseif (preg_match('~^agents/evidence/([a-z0-9-]+)\.json$~', $n['path'], $m)) $evidence[$m[1]] = $n['sha'];
        elseif (preg_match('~^src/content/providers/(\d{8}-[0-9a-f]{8})\.json$~', $n['path'], $m)) $providers[$m[1]] = $n['sha'];
    }
    $out = ['entries' => $entries, 'evidence' => $evidence, 'providers' => $providers, 'head' => $t['sha'] ?? ''];
    cache_put('tree', $out);
    return $out;
}

/** Blob contents are immutable per sha, so they are cached on disk for good. */
function blob_json(string $sha): ?array {
    if (!preg_match('/^[0-9a-f]{40}$/', $sha)) return null;
    $f = data_dir() . "/blob-$sha.json";
    if (is_file($f)) return json_decode((string)file_get_contents($f), true);
    $b = gh_ok(gh('GET', '/repos/' . repo() . '/git/blobs/' . $sha), 'read file');
    $txt = base64_decode(str_replace("\n", '', $b['content'] ?? ''));
    $d = json_decode($txt, true);
    if (!is_array($d)) return null;
    @file_put_contents($f, $txt, LOCK_EX);
    return $d;
}

// ---------------------------------------------------------------- review helpers
function review_branch_ok(string $ref): bool { return (bool)preg_match('~^(agents|images)/[A-Za-z0-9._/-]+$~', $ref); }

/** An open, same-repo agent pull request; anything else is refused. */
function review_pr_open(int $n): array {
    $p = gh_ok(gh('GET', '/repos/' . repo() . "/pulls/$n"), 'read PR');
    if (($p['state'] ?? '') !== 'open' || !empty($p['draft'])) json_out(422, ['error' => 'This pull request is not open.']);
    if (!review_branch_ok($p['head']['ref'] ?? '') || (($p['head']['repo']['full_name'] ?? repo()) !== repo())) json_out(422, ['error' => 'Only agent pull requests can be reviewed here. Use Pull requests for others.']);
    return $p;
}

/** Plain-words card for one entry in a pull request. */
function review_card(array $e, ?array $ev, string $fileStatus, string $head): array {
    $live = ($e['status'] ?? '') === 'approved';
    $j = $e; $j['status'] = 'draft';
    $v = evidence_summary($ev);
    $imgs = [];
    foreach ($e['images'] ?? [] as $im) {
        if (!is_array($im) || !preg_match('~^/images/discover/[A-Za-z0-9/_.-]+$~', $im['src'] ?? '')) continue;
        $imgs[] = ['url' => 'https://raw.githubusercontent.com/' . repo() . "/$head/public" . $im['src'], 'alt' => (string)($im['alt'] ?? ''), 'credit' => (string)($im['credit'] ?? ''), 'license' => (string)($im['license'] ?? '')];
    }
    $facts = null;
    if ($v) {
        $c = $v['counts']; $t = array_sum($c);
        $facts = "$t claims checked: {$c['supported']} supported by sources, {$c['partly_supported']} partly, {$c['unverifiable']} could not be confirmed, {$c['contradicted']} contradicted.";
    }
    $srcs = [];
    foreach ($e['sources'] ?? [] as $s) if (is_array($s) && preg_match('~^https://~', $s['url'] ?? '')) $srcs[] = ['label' => (string)($s['label'] ?? $s['url']), 'url' => $s['url']];
    return [
        'slug' => $e['slug'] ?? '', 'category' => $e['category'] ?? '', 'name' => $e['name'] ?? '', 'district' => $e['district'] ?? '',
        'change' => $live ? 'update to a live page' : ($fileStatus === 'added' ? 'new entry' : 'updated draft'),
        'live' => $live, 'summary' => (string)($e['summary'] ?? ''),
        'about' => (string)($e['history']['significance'] ?? ''), 'tradition' => (string)($e['folklore']['title'] ?? ''), 'meaning' => (string)($e['spiritual']['summary'] ?? ''),
        'images' => $imgs, 'sources' => $srcs,
        'blockers' => $live ? [] : publish_blockers($j),
        'verifier' => $v ? ['score' => $v['score'], 'ready' => !$v['gateReasons'], 'facts' => $facts, 'gates' => $v['gateReasons'], 'notes' => array_slice(array_map(fn($i) => trim(($i['field'] ?? '') . ': ' . ($i['problem'] ?? $i['detail'] ?? $i['issue'] ?? '')), $v['issues']), 0, 6)] : null,
    ];
}

function check_state(string $sha): array {
    $r = gh_ok(gh('GET', '/repos/' . repo() . "/commits/$sha/check-runs", null, ['per_page' => 50]), 'read checks');
    $runs = $r['check_runs'] ?? [];
    if (!$runs) return ['state' => 'none', 'runs' => 0];
    $bad = 0; $pending = 0; $needs = 0;
    foreach ($runs as $x) {
        if (($x['status'] ?? '') !== 'completed') { $pending++; continue; }
        $c = $x['conclusion'] ?? '';
        if ($c === 'action_required') $needs++;
        elseif (!in_array($c, ['success', 'neutral', 'skipped'], true)) $bad++;
    }
    $state = $bad ? 'failed' : ($needs ? 'needs_approval' : ($pending ? 'running' : 'passed'));
    return ['state' => $state, 'runs' => count($runs)];
}

// ---------------------------------------------------------------- public actions
if ($a === 'status') {
    $authed = is_authed();
    // Names of the settings still absent from vh-config.php (never their values).
    $missing = [];
    if (!preg_match('~^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$~', (string)(cfg()['repo'] ?? ''))) $missing[] = 'repo';
    if (!(cfg()['admin_github_token'] ?? (cfg()['github_token'] ?? ''))) $missing[] = 'admin_github_token';
    if (!(cfg()['admin_password_hash'] ?? '')) $missing[] = 'admin_password_hash';
    json_out(200, [
        'configError' => vh_cfg_error_line() ?: null,
        'config' => vh_cfg_where(),
        'authed' => $authed, 'csrf' => $authed ? ($_SESSION['csrf'] ?? '') : '',
        'configured' => !$missing,
        'missing' => $missing,
        'needsHash' => !(cfg()['admin_password_hash'] ?? ''),
    ]);
}

if ($a === 'login' && $method === 'POST') {
    $wait = throttle_locked();
    if ($wait > 0) json_out(429, ['error' => 'Too many attempts. Try again in ' . ceil($wait / 60) . ' minutes.']);
    $hash = cfg()['admin_password_hash'] ?? '';
    $pw = is_string($in['password'] ?? null) ? $in['password'] : '';
    if (!$hash || !ip_allowed() || !password_verify($pw, $hash)) {
        throttle_fail(); audit('login-failed'); usleep(400000);
        json_out(401, ['error' => 'Incorrect password.']);
    }
    start_session(); session_regenerate_id(true);
    $_SESSION = ['ok' => true, 'born' => time(), 'seen' => time(), 'csrf' => bin2hex(random_bytes(24))];
    throttle_reset(); audit('login');
    json_out(200, ['ok' => true, 'csrf' => $_SESSION['csrf']]);
}

if ($a === 'setup' && $method === 'POST') {
    // One-time helper: turns a chosen password into the hash to paste into vh-config.php. Disabled once a hash exists.
    if (cfg()['admin_password_hash'] ?? '') json_out(403, ['error' => 'Already set up.']);
    $pw = is_string($in['password'] ?? null) ? $in['password'] : '';
    if (strlen($pw) < 14) json_out(400, ['error' => 'Use at least 14 characters (a passphrase of 4 or more words works well).']);
    json_out(200, ['hash' => password_hash($pw, PASSWORD_DEFAULT)]);
}

// ---------------------------------------------------------------- everything below needs login
require_auth($method === 'POST');

try {
    switch ($a) {
    case 'logout':
        audit('logout'); $_SESSION = []; session_destroy(); json_out(200, ['ok' => true]);

    case 'overview': {
        $ix = tree_index(); $draft = 0; $approved = 0;
        foreach ($ix['entries'] as $e) { $d = blob_json($e['sha']); if (($d['status'] ?? '') === 'approved') $approved++; else $draft++; }
        $prs = gh_ok(gh('GET', '/repos/' . repo() . '/pulls', null, ['state' => 'open', 'per_page' => 30]), 'list PRs');
        $iss = gh_ok(gh('GET', '/repos/' . repo() . '/issues', null, ['labels' => 'story-submission', 'state' => 'open', 'per_page' => 50]), 'list stories');
        $stories = count(array_filter($iss, fn($i) => empty($i['pull_request']) && !in_array('approved', array_column($i['labels'] ?? [], 'name'), true)));
        json_out(200, ['drafts' => $draft, 'approved' => $approved, 'openPrs' => count($prs), 'stories' => $stories]);
    }

    case 'drafts': {
        $ix = tree_index(); $rows = [];
        foreach ($ix['entries'] as $e) {
            $d = blob_json($e['sha']); if (!$d) continue;
            $ev = isset($ix['evidence'][$e['slug']]) ? blob_json($ix['evidence'][$e['slug']]) : null;
            $rows[] = draft_row($d, $ev, ['path' => $e['path']]);
        }
        usort($rows, fn($x, $y) => [$x['status'] !== 'draft', $x['name']] <=> [$y['status'] !== 'draft', $y['name']]);
        json_out(200, ['entries' => $rows]);
    }

    case 'entry': {
        $cat = $_GET['category'] ?? ''; $slug = $_GET['slug'] ?? '';
        if (!in_array($cat, CATS, true) || !valid_slug($slug)) json_out(400, ['error' => 'Bad request.']);
        $f = gh_file("src/content/$cat/$slug.json", 'main');
        if (!$f) json_out(404, ['error' => 'Not found.']);
        json_out(200, ['entry' => json_decode($f['text'], true)]);
    }

    case 'set_status': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $cat = need_str($in, 'category', 30); $slug = need_str($in, 'slug', 80); $to = need_str($in, 'status', 10);
        if (!in_array($cat, CATS, true) || !valid_slug($slug) || !in_array($to, ['approved', 'draft'], true)) json_out(400, ['error' => 'Bad request.']);
        $path = "src/content/$cat/$slug.json";
        $f = gh_file($path, 'main');
        if (!$f) json_out(404, ['error' => 'Entry not found on main.']);
        $e = json_decode($f['text'], true);
        if (!is_array($e)) json_out(422, ['error' => 'Entry file is not valid JSON.']);
        if ($to === 'approved') {
            $e['status'] = 'draft'; // judge it as a draft: blockers apply to what is being published
            $blockers = publish_blockers($e);
            if ($blockers) json_out(422, ['error' => 'Cannot publish yet.', 'blockers' => $blockers]);
            $ix = tree_index();
            $ev = isset($ix['evidence'][$slug]) ? blob_json($ix['evidence'][$slug]) : null;
            $gates = evidence_summary($ev)['gateReasons'] ?? [];
            if ($gates && empty($in['override'])) json_out(409, ['error' => 'The verifier flagged this entry.', 'gates' => $gates, 'needsOverride' => true]);
            $e['status'] = 'approved'; $e['lastVerified'] = gmdate('Y-m-d');
        } else {
            $e['status'] = 'draft';
        }
        $msg = ($to === 'approved' ? 'Publish' : 'Unpublish') . ' ' . ($e['name'] ?? $slug) . ' (admin)';
        gh_ok(gh('PUT', '/repos/' . repo() . "/contents/$path", [
            'message' => $msg, 'branch' => 'main', 'sha' => $f['sha'],
            'content' => base64_encode(json_encode($e, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n"),
        ]), 'save entry');
        cache_clear(); audit('set-status', ['entry' => "$cat/$slug", 'to' => $to, 'override' => !empty($in['override'])]);
        json_out(200, ['ok' => true, 'message' => $to === 'approved' ? 'Published. The site rebuilds and goes live in a few minutes.' : 'Unpublished. The site rebuilds in a few minutes.']);
    }

    case 'prs': {
        $list = gh_ok(gh('GET', '/repos/' . repo() . '/pulls', null, ['state' => 'open', 'per_page' => 20]), 'list PRs');
        $rows = [];
        foreach ($list as $p) {
            $full = gh_ok(gh('GET', '/repos/' . repo() . '/pulls/' . (int)$p['number']), 'read PR');
            $ck = check_state($p['head']['sha']);
            $rows[] = ['number' => $p['number'], 'title' => $p['title'], 'by' => $p['user']['login'] ?? '', 'branch' => $p['head']['ref'], 'url' => $p['html_url'],
                'checks' => $ck['state'], 'mergeable' => $full['mergeable'] ?? null, 'draft' => (bool)($p['draft'] ?? false), 'files' => $full['changed_files'] ?? null, 'updated' => $p['updated_at']];
        }
        json_out(200, ['prs' => $rows]);
    }

    // ---- Review: everything one agent run produced, approved and merged as ONE pull request (one deploy).
    case 'review_list': {
        $list = gh_ok(gh('GET', '/repos/' . repo() . '/pulls', null, ['state' => 'open', 'per_page' => 20]), 'list PRs');
        $rows = [];
        foreach ($list as $p) {
            if (!review_branch_ok($p['head']['ref'] ?? '')) continue;
            $rows[] = ['number' => $p['number'], 'title' => $p['title'], 'branch' => $p['head']['ref'], 'updated' => $p['updated_at'] ?? '', 'url' => $p['html_url'] ?? ''];
        }
        json_out(200, ['prs' => $rows]);
    }

    case 'review_pr': {
        $n = (int)($_GET['number'] ?? 0); if ($n < 1) json_out(400, ['error' => 'Bad request.']);
        $p = review_pr_open($n); $head = $p['head']['sha'];
        $files = gh_ok(gh('GET', '/repos/' . repo() . "/pulls/$n/files", null, ['per_page' => 100]), 'read PR files');
        $cards = []; $photos = 0; $other = 0; $evs = [];
        foreach ($files as $f) {
            $fn = $f['filename'] ?? '';
            if (($f['status'] ?? '') === 'removed') { $other++; continue; }
            if (preg_match('~^src/content/(' . implode('|', CATS) . ')/([a-z0-9-]+)\.json$~', $fn, $m)) {
                $file = gh_file($fn, $head); $e = $file ? json_decode($file['text'], true) : null; if (!is_array($e)) continue;
                $evf = gh_file("agents/evidence/{$m[2]}.json", $head); $ev = $evf ? json_decode($evf['text'], true) : null;
                $cards[] = review_card($e, $ev, $f['status'] ?? 'modified', $head);
            } elseif ($fn === 'src/content/events/calendar.json') {
                $hf = gh_file($fn, $head); $mf = gh_file($fn, 'main');
                $hc = $hf ? json_decode($hf['text'], true) : null; $mc = $mf ? json_decode($mf['text'], true) : null;
                $old = []; foreach (($mc['events'] ?? []) as $x) $old[$x['id'] ?? ''] = $x;
                foreach (($hc['events'] ?? []) as $x) if (is_array($x) && !isset($old[$x['id'] ?? ''])) $evs[] = ['name' => (string)($x['name'] ?? ''), 'start' => (string)($x['start'] ?? ''), 'end' => (string)($x['end'] ?? ''), 'place' => (string)($x['place'] ?? ''), 'district' => (string)($x['district'] ?? ''), 'certainty' => (string)($x['certainty'] ?? ''), 'summary' => (string)($x['summary'] ?? ''), 'sources' => array_values(array_filter(array_map(fn($s) => preg_match('~^https://~', $s['url'] ?? '') ? ['label' => (string)($s['label'] ?? $s['url']), 'url' => $s['url']] : null, is_array($x['sources'] ?? null) ? $x['sources'] : [])))];
            } elseif (strpos($fn, 'public/images/') === 0) $photos++;
            else $other++;
        }
        $ck = check_state($head);
        json_out(200, ['number' => $n, 'title' => $p['title'], 'head' => $head, 'branch' => $p['head']['ref'], 'url' => $p['html_url'] ?? '', 'checks' => $ck['state'],
            'mergeable' => $p['mergeable'] ?? null, 'cards' => $cards, 'events' => $evs, 'photoFiles' => $photos, 'otherFiles' => $other]);
    }

    case 'review_apply': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $n = need_int($in, 'number'); $seenHead = need_str($in, 'head', 40);
        $p = review_pr_open($n); $head = $p['head']['sha'];
        if ($seenHead !== $head) json_out(409, ['error' => 'This pull request changed since you opened it. Reload the review and look again.', 'stale' => true]);
        $pick = is_array($in['publish'] ?? null) ? $in['publish'] : [];
        $over = is_array($in['override'] ?? null) ? $in['override'] : [];
        $files = []; $names = []; $problems = []; $gated = [];
        foreach ($pick as $it) {
            $cat = (string)($it['category'] ?? ''); $slug = (string)($it['slug'] ?? '');
            if (!in_array($cat, CATS, true) || !valid_slug($slug)) json_out(400, ['error' => 'Bad request.']);
            $path = "src/content/$cat/$slug.json";
            $f = gh_file($path, $head); $e = $f ? json_decode($f['text'], true) : null;
            if (!is_array($e)) json_out(404, ['error' => "$slug is not part of this pull request."]);
            $e['status'] = 'draft';
            if ($b = publish_blockers($e)) { $problems[] = ($e['name'] ?? $slug) . ': ' . implode(' ', $b); continue; }
            $evf = gh_file("agents/evidence/$slug.json", $head);
            $g = evidence_summary($evf ? json_decode($evf['text'], true) : null)['gateReasons'] ?? [];
            if ($g && !in_array($slug, $over, true)) { $gated[] = ['slug' => $slug, 'name' => $e['name'] ?? $slug, 'gates' => $g]; continue; }
            $e['status'] = 'approved'; $e['lastVerified'] = gmdate('Y-m-d');
            $files[$path] = ['text' => json_encode($e, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n"];
            $names[] = $e['name'] ?? $slug;
        }
        if ($problems) json_out(422, ['error' => 'Some items cannot be published yet.', 'blockers' => $problems]);
        if ($gated) json_out(409, ['error' => 'The fact-checker flagged some items.', 'needsOverride' => true, 'gated' => $gated]);
        if ($files) {
            gh_commit_files($files, 'Publish ' . count($names) . ' reviewed entries (admin): ' . implode(', ', array_slice($names, 0, 6)), $p['head']['ref']);
        }
        audit('review-apply', ['pr' => $n, 'published' => array_keys($files), 'override' => $over]);
        json_out(200, ['ok' => true, 'published' => count($files), 'committed' => (bool)$files]);
    }

    // ---- Upload your own photo and attach it to a guide (one commit: the picture and the entry's image list).
    case 'photo_upload': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $cat = need_str($in, 'category', 30); $slug = need_str($in, 'slug', 80);
        $credit = trim(strip_tags(need_str($in, 'credit', 120))); $alt = trim(strip_tags(need_str($in, 'alt', 200)));
        if (!in_array($cat, CATS, true) || !valid_slug($slug)) json_out(400, ['error' => 'Bad request.']);
        if (strlen($credit) < 2 || strlen($alt) < 5) json_out(422, ['error' => 'Type who took the photo and a short description of what it shows.']);
        $bin = base64_decode(preg_replace('~^data:image/\w+;base64,~', '', need_str($in, 'image', 2500000)), true);
        if ($bin === false || strlen($bin) > 1800000) json_out(422, ['error' => 'The picture is missing or larger than 1.8 MB.']);
        $info = @getimagesizefromstring($bin);
        if (!$info || $info[2] !== IMAGETYPE_JPEG) json_out(422, ['error' => 'Use a JPEG picture.']);
        if ($info[0] < 600 || $info[1] < 400 || $info[0] > 4000 || $info[1] > 4000) json_out(422, ['error' => 'The picture must be between 600 and 4000 pixels wide.']);
        if (function_exists('imagecreatefromstring') && ($im = @imagecreatefromstring($bin))) { // re-encode: drops EXIF (location, camera)
            ob_start(); imagejpeg($im, null, 85); $re = ob_get_clean(); imagedestroy($im); if ($re) $bin = $re;
        }
        $branch = 'main'; $ref = 'main';
        if (isset($in['number'])) { $p = review_pr_open(need_int($in, 'number')); $branch = $p['head']['ref']; $ref = $p['head']['sha']; }
        $path = "src/content/$cat/$slug.json";
        $f = gh_file($path, $ref); $e = $f ? json_decode($f['text'], true) : null;
        if (!is_array($e)) json_out(404, ['error' => 'Entry not found.']);
        $n = 1; $have = array_map(fn($i) => $i['src'] ?? '', is_array($e['images'] ?? null) ? $e['images'] : []);
        while (in_array("/images/discover/$slug-own-$n.jpg", $have, true)) $n++;
        $src = "/images/discover/$slug-own-$n.jpg";
        $e['images'] = array_merge(is_array($e['images'] ?? null) ? $e['images'] : [], [[
            'src' => $src, 'alt' => $alt, 'credit' => $credit, 'license' => 'Own photo, used with the photographer\'s permission',
            'sourceUrl' => rtrim((string)(cfg()['site_url'] ?? 'https://vedaheritage.co.in'), '/') . '/',
        ]]);
        gh_commit_files(["public$src" => ['b64' => base64_encode($bin)], $path => ['text' => json_encode($e, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n"]],
            'Add own photo to ' . ($e['name'] ?? $slug) . ' (admin)', $branch);
        audit('photo-upload', ['entry' => "$cat/$slug", 'branch' => $branch, 'bytes' => strlen($bin)]);
        json_out(200, ['ok' => true, 'message' => $branch === 'main' ? 'Photo attached. The site rebuilds in a few minutes.' : 'Photo attached to the batch. Reload the review to see it.']);
    }

    case 'merge_pr': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $n = need_int($in, 'number');
        $p = gh_ok(gh('GET', '/repos/' . repo() . "/pulls/$n"), 'read PR');
        if (($p['state'] ?? '') !== 'open' || !empty($p['draft'])) json_out(422, ['error' => 'This PR is not open for merging.']);
        $ck = check_state($p['head']['sha']);
        if ($ck['state'] !== 'passed') json_out(422, ['error' => 'Checks are not green (' . $ck['state'] . '). Merge is blocked until they pass.']);
        if (($p['mergeable'] ?? null) === false) json_out(422, ['error' => 'This PR has a merge conflict.']);
        gh_ok(gh('PUT', '/repos/' . repo() . "/pulls/$n/merge", ['merge_method' => 'merge', 'sha' => $p['head']['sha']]), 'merge');
        cache_clear(); audit('merge-pr', ['pr' => $n]);
        json_out(200, ['ok' => true, 'message' => "Merged #$n. The site rebuilds and goes live in a few minutes."]);
    }

    case 'close_pr': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $n = need_int($in, 'number');
        gh_ok(gh('PATCH', '/repos/' . repo() . "/pulls/$n", ['state' => 'closed']), 'close PR');
        audit('close-pr', ['pr' => $n]); json_out(200, ['ok' => true]);
    }

    case 'stories': {
        $iss = gh_ok(gh('GET', '/repos/' . repo() . '/issues', null, ['labels' => 'story-submission', 'state' => 'open', 'per_page' => 50]), 'list stories');
        $rows = [];
        foreach ($iss as $i) {
            if (!empty($i['pull_request'])) continue;
            $labels = array_column($i['labels'] ?? [], 'name');
            $rows[] = ['number' => $i['number'], 'title' => mb_substr((string)$i['title'], 0, 160), 'body' => mb_substr((string)($i['body'] ?? ''), 0, 4000),
                'created' => $i['created_at'], 'url' => $i['html_url'], 'approved' => in_array('approved', $labels, true)];
        }
        json_out(200, ['stories' => $rows]);
    }

    case 'story_decision': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $n = need_int($in, 'number'); $d = need_str($in, 'decision', 10);
        if (!in_array($d, ['approve', 'reject'], true)) json_out(400, ['error' => 'Bad request.']);
        $i = gh_ok(gh('GET', '/repos/' . repo() . "/issues/$n"), 'read story');
        if (!in_array('story-submission', array_column($i['labels'] ?? [], 'name'), true) || !empty($i['pull_request'])) json_out(422, ['error' => 'Not a story submission.']);
        if ($d === 'approve') gh_ok(gh('POST', '/repos/' . repo() . "/issues/$n/labels", ['labels' => ['approved']]), 'label');
        else gh_ok(gh('PATCH', '/repos/' . repo() . "/issues/$n", ['state' => 'closed', 'state_reason' => 'not_planned']), 'close');
        audit('story-' . $d, ['issue' => $n]);
        json_out(200, ['ok' => true, 'message' => $d === 'approve' ? 'Approved. A pull request with the story opens in a minute; merge it from the Pull requests tab to publish.' : 'Rejected and closed.']);
    }

    case 'run_workflow': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $w = need_str($in, 'workflow', 40); $inp = is_array($in['inputs'] ?? null) ? $in['inputs'] : [];
        $send = [];
        if ($w === 'content-agents') {
            $cmd = $inp['command'] ?? 'pipeline';
            if (!in_array($cmd, ['pipeline', 'scout', 'enrich', 'verify'], true)) json_out(400, ['error' => 'Bad command.']);
            $max = (string)($inp['max'] ?? '3'); if (!preg_match('/^([1-9]|10)$/', $max)) json_out(400, ['error' => 'Max must be 1 to 10.']);
            $bud = (string)($inp['budget'] ?? '5'); if (!preg_match('/^([1-9]|1[0-9]|20)$/', $bud)) json_out(400, ['error' => 'Budget must be 1 to 20 USD.']);
            $slugs = (string)($inp['slugs'] ?? ''); if ($slugs !== '' && !preg_match('/^[a-z0-9-]+(,[a-z0-9-]+){0,9}$/', $slugs)) json_out(400, ['error' => 'Slugs must be comma-separated.']);
            $pv = (string)($inp['provider'] ?? 'saved'); $vv = (string)($inp['verifier'] ?? 'saved');
            foreach ([$pv, $vv] as $x) if (!in_array($x, ['saved', 'auto', 'xai', 'openai', 'anthropic'], true)) json_out(400, ['error' => 'Bad provider.']);
            $send = ['command' => $cmd, 'max' => $max, 'budget' => $bud, 'provider' => $pv, 'verifier' => $vv] + ($slugs !== '' ? ['slugs' => $slugs] : []);
            $file = 'content-agents.yml';
        } elseif ($w === 'fetch-images') {
            $slug = (string)($inp['slug'] ?? ''); if ($slug !== '' && !valid_slug($slug)) json_out(400, ['error' => 'Bad slug.']);
            $send = ($slug !== '' ? ['slug' => $slug] : []) + ['force' => !empty($inp['force']) ? 'true' : 'false'];
            $file = 'fetch-images.yml';
        } elseif ($w === 'events') {
            $pv = (string)($inp['provider'] ?? 'saved');
            if (!in_array($pv, ['saved', 'auto', 'xai', 'openai', 'anthropic'], true)) json_out(400, ['error' => 'Bad provider.']);
            $send = ['provider' => $pv]; $file = 'events.yml';
        } elseif ($w === 'link-check') { $file = 'link-check.yml'; }
        else json_out(400, ['error' => 'Unknown workflow.']);
        $r = gh('POST', '/repos/' . repo() . "/actions/workflows/$file/dispatches", ['ref' => 'main'] + ($send ? ['inputs' => $send] : []));
        gh_ok($r, 'start workflow');
        audit('run-workflow', ['workflow' => $w, 'inputs' => $send]);
        json_out(200, ['ok' => true, 'message' => 'Started. Agent runs take about 15 to 20 minutes; a pull request appears when they finish.']);
    }

    case 'site': {
        $runs = [];
        foreach (['deploy.yml', 'content-agents.yml', 'events.yml', 'fetch-images.yml'] as $wf) {
            $r = gh('GET', '/repos/' . repo() . "/actions/workflows/$wf/runs", null, ['per_page' => 3]);
            foreach (($r[1]['workflow_runs'] ?? []) as $x) $runs[] = ['workflow' => $wf, 'status' => $x['status'], 'conclusion' => $x['conclusion'], 'when' => $x['created_at'], 'url' => $x['html_url'], 'sha' => substr($x['head_sha'], 0, 7), 'event' => $x['event']];
        }
        usort($runs, fn($x, $y) => strcmp($y['when'], $x['when']));
        $head = gh_ok(gh('GET', '/repos/' . repo() . '/commits/main'), 'read main');
        $live = null; $site = cfg()['site_url'] ?? 'https://www.vedaheritage.co.in';
        $ch = curl_init(rtrim($site, '/') . '/version.txt'); curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_FOLLOWLOCATION => true]);
        $v = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        if ($v !== false && $code === 200) $live = trim(substr((string)$v, 0, 200));
        json_out(200, ['main' => substr($head['sha'], 0, 7), 'mainMessage' => strtok($head['commit']['message'] ?? '', "\n"), 'liveVersion' => $live, 'liveOk' => $code === 200, 'runs' => array_slice($runs, 0, 8)]);
    }


    // ------------------------------------------------------------ marketplace
    case 'market': {
        $subs = []; foreach (glob(market_dir('submissions') . '/*.json') ?: [] as $f) { $d = json_file($f); if ($d) $subs[] = $d; }
        usort($subs, fn($x, $y) => strcmp($y['created'] ?? '', $x['created'] ?? ''));
        $byId = []; foreach ($subs as $d) $byId[$d['id']] = $d;
        $pending = []; $live = [];
        foreach ($subs as $d) {
            $row = ['id' => $d['id'], 'title' => $d['title'], 'category' => MARKET_CATEGORIES[$d['category']] ?? $d['category'], 'condition' => $d['condition'], 'price' => $d['priceInr'],
                'district' => $d['district'], 'created' => $d['created'], 'status' => $d['status'], 'photos' => count($d['photos'] ?? [])];
            if ($d['status'] === 'pending') {
                $row += ['description' => $d['description'], 'sellerName' => $d['sellerName'], 'contactEmail' => $d['contactEmail'] ?? '', 'contactPhone' => $d['contactPhone'] ?? '',
                    'blockers' => listing_blockers($d), 'flags' => market_flags($d['title'] . ' ' . $d['description'])];
                $pending[] = $row;
            } elseif (in_array($d['status'], ['approved', 'sold'], true)) $live[] = $row;
        }
        $enq = []; foreach (glob(market_dir('enquiries') . '/*.json') ?: [] as $f) { $e = json_file($f); if ($e && ($e['status'] ?? '') === 'open') {
            $s = $byId[$e['listingId']] ?? null;
            $enq[] = $e + ['seller' => $s ? ['name' => $s['sellerName'], 'email' => $s['contactEmail'] ?? '', 'phone' => $s['contactPhone'] ?? ''] : null]; } }
        usort($enq, fn($x, $y) => strcmp($y['created'], $x['created']));
        json_out(200, ['pending' => $pending, 'live' => $live, 'enquiries' => $enq]);
    }

    case 'market_photo': {
        $id = $_GET['id'] ?? ''; $n = (int)($_GET['n'] ?? 0);
        if (!valid_id($id) || $n < 1 || $n > 3) json_out(400, ['error' => 'Bad request.']);
        $f = market_dir('photos') . "/$id-$n.jpg";
        if (!is_file($f)) json_out(404, ['error' => 'Not found.']);
        header('Content-Type: image/jpeg'); header('Cache-Control: private, no-store'); header('X-Content-Type-Options: nosniff');
        readfile($f); exit;
    }

    case 'market_decide': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $id = need_str($in, 'id', 20); $d = need_str($in, 'decision', 10);
        if (!valid_id($id) || !in_array($d, ['approve', 'reject'], true)) json_out(400, ['error' => 'Bad request.']);
        $path = market_dir('submissions') . "/$id.json"; $sub = json_file($path);
        if (!$sub || $sub['status'] !== 'pending') json_out(404, ['error' => 'No pending submission with that id.']);
        if ($d === 'reject') {
            foreach ($sub['photos'] as $p) @unlink(market_dir('photos') . '/' . basename($p));
            $sub = ['id' => $id, 'status' => 'rejected', 'created' => $sub['created'], 'title' => $sub['title'], 'category' => $sub['category'], 'condition' => $sub['condition'], 'priceInr' => $sub['priceInr'], 'district' => $sub['district'], 'photos' => [], 'rejected' => gmdate('c')];
            save_json($path, $sub); audit('market-reject', ['listing' => $id]);
            json_out(200, ['ok' => true, 'message' => 'Rejected. The seller\'s contact details and photos were deleted.']);
        }
        $blockers = listing_blockers($sub);
        if ($blockers) json_out(422, ['error' => 'Cannot publish yet.', 'blockers' => $blockers]);
        $flags = market_flags($sub['title'] . ' ' . $sub['description']);
        if ($flags && empty($in['override'])) json_out(409, ['error' => 'This listing needs a second look.', 'flags' => $flags, 'needsOverride' => true]);
        $files = []; $photos = [];
        foreach ($sub['photos'] as $i => $p) {
            $bytes = @file_get_contents(market_dir('photos') . '/' . basename($p));
            if ($bytes === false) json_out(500, ['error' => 'A photo file is missing on the server.']);
            $dest = "public/images/marketplace/$id-" . ($i + 1) . '.jpg';
            $files[$dest] = ['b64' => base64_encode($bytes)];
            $photos[] = ['src' => '/images/marketplace/' . basename($dest), 'alt' => $sub['title'] . ' (photo ' . ($i + 1) . ')'];
        }
        $listing = ['id' => $id, 'title' => $sub['title'], 'category' => $sub['category'], 'condition' => $sub['condition'], 'priceInr' => $sub['priceInr'],
            'description' => $sub['description'], 'district' => $sub['district'], 'sellerFirstName' => $sub['sellerName'], 'photos' => $photos,
            'listedOn' => gmdate('Y-m-d'), 'expiresOn' => gmdate('Y-m-d', time() + MARKET_LISTING_DAYS * 86400), 'status' => 'approved'];
        $files["src/content/listings/$id.json"] = ['text' => json_encode($listing, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n"];
        gh_commit_files($files, 'Publish marketplace listing: ' . $sub['title'] . ' (admin)');
        $sub['status'] = 'approved'; $sub['approved'] = gmdate('c'); save_json($path, $sub);
        audit('market-approve', ['listing' => $id, 'override' => !empty($in['override'])]);
        json_out(200, ['ok' => true, 'message' => 'Published. The listing goes live after the next rebuild (a few minutes).']);
    }

    case 'market_status': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $id = need_str($in, 'id', 20); $to = need_str($in, 'status', 10);
        if (!valid_id($id) || !in_array($to, ['sold', 'removed'], true)) json_out(400, ['error' => 'Bad request.']);
        $path = market_dir('submissions') . "/$id.json"; $sub = json_file($path);
        if (!$sub || !in_array($sub['status'], ['approved', 'sold'], true)) json_out(404, ['error' => 'No live listing with that id.']);
        $file = "src/content/listings/$id.json"; $f = gh_file($file, 'main');
        if (!$f) json_out(404, ['error' => 'Listing file not found on main.']);
        $listing = json_decode($f['text'], true);
        if (!is_array($listing)) json_out(422, ['error' => 'Listing file is not valid JSON.']);
        $listing['status'] = $to;
        $files = [$file => ['text' => json_encode($listing, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n"]];
        gh_commit_files($files, ($to === 'sold' ? 'Mark sold: ' : 'Remove listing: ') . $listing['title'] . ' (admin)');
        if ($to === 'removed') { $sub['contactEmail'] = ''; $sub['contactPhone'] = ''; }
        $sub['status'] = $to; save_json($path, $sub);
        audit('market-' . $to, ['listing' => $id]);
        json_out(200, ['ok' => true, 'message' => $to === 'sold' ? 'Marked sold.' : 'Removed. The seller contact details were deleted.']);
    }

    case 'market_enquiry_done': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $id = need_str($in, 'id', 20); if (!valid_id($id)) json_out(400, ['error' => 'Bad request.']);
        $path = market_dir('enquiries') . "/$id.json"; $e = json_file($path);
        if (!$e) json_out(404, ['error' => 'Not found.']);
        // Data minimisation: once introduced, keep the record but drop the buyer's contact details.
        $e['status'] = 'introduced'; $e['contactEmail'] = ''; $e['contactPhone'] = ''; $e['message'] = ''; $e['done'] = gmdate('c');
        save_json($path, $e); audit('market-enquiry-done', ['enquiry' => $id]);
        json_out(200, ['ok' => true]);
    }

    // ------------------------------------------------------------ service-provider directory
    case 'prov': {
        $subs = []; foreach (glob(market_dir('providers') . '/*.json') ?: [] as $f) { $d = json_file($f); if ($d) $subs[] = $d; }
        usort($subs, fn($x, $y) => strcmp($y['created'] ?? '', $x['created'] ?? ''));
        $queue = []; $live = []; $today = gmdate('Y-m-d'); $checked = 0;
        $pub = []; foreach (tree_index()['providers'] as $pid => $sha) { $pj = blob_json($sha); if ($pj) $pub[$pid] = $pj; }
        foreach ($subs as $d) {
            if ($d['status'] === 'pending') {
                $site = null;
                if (!empty($d['website']) && $checked++ < 10) $site = website_check($d['website']);
                $txt = $d['name'] . ' ' . $d['summary'];
                $dups = []; foreach ($subs as $o) if ($o['id'] !== $d['id'] && !in_array($o['status'], ['rejected', 'removed'], true) && (($o['email'] ?? '') === $d['email'] || ($o['phone'] ?? '') === $d['phone'])) $dups[] = $o['name'];
                $queue[] = ['id' => $d['id'], 'name' => $d['name'], 'type' => PROVIDER_TYPES[$d['type']][0] ?? $d['type'], 'typeKey' => $d['type'], 'districts' => $d['districts'], 'summary' => $d['summary'],
                    'phone' => $d['phone'], 'email' => $d['email'], 'website' => $d['website'], 'address' => $d['address'], 'credentialKind' => $d['credentialKind'], 'credentialNumber' => $d['credentialNumber'],
                    'contactPerson' => $d['contactPerson'], 'contactPersonPhone' => $d['contactPersonPhone'], 'created' => $d['created'], 'emailVerified' => !empty($d['emailVerified']), 'emailSent' => !empty($d['emailSent']),
                    'needsCredential' => PROVIDER_TYPES[$d['type']][1] ?? false, 'site' => $site, 'emailMatchesSite' => $site && email_domain($d['email']) === host_of($d['website']),
                    'flags' => provider_flags($txt), 'duplicates' => $dups];
            } elseif (in_array($d['status'], ['approved', 'suspended'], true)) {
                $p = $pub[$d['id']] ?? null;
                $live[] = ['id' => $d['id'], 'name' => $d['name'], 'type' => $d['type'], 'typeLabel' => PROVIDER_TYPES[$d['type']][0] ?? $d['type'], 'districts' => $d['districts'], 'status' => $p['status'] ?? $d['status'],
                    'verifiedOn' => $p['verifiedOn'] ?? null, 'reverifyBy' => $p['reverifyBy'] ?? null, 'due' => isset($p['reverifyBy']) && $p['reverifyBy'] <= gmdate('Y-m-d', time() + 30 * 86400), 'sponsored' => $p['sponsored'] ?? null,
                    'sponsorable' => PROVIDER_TYPES[$d['type']][2] ?? false, 'phone' => $d['phone'], 'email' => $d['email']];
            }
        }
        $reports = []; foreach (glob(market_dir('reports') . '/*.json') ?: [] as $f) { $r = json_file($f); if ($r && ($r['status'] ?? '') === 'open') $reports[] = $r; }
        usort($reports, fn($x, $y) => strcmp($y['created'], $x['created']));
        json_out(200, ['queue' => $queue, 'live' => $live, 'reports' => $reports]);
    }

    case 'prov_decide': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $id = need_str($in, 'id', 20); $d = need_str($in, 'decision', 10);
        if (!valid_id($id) || !in_array($d, ['approve', 'reject'], true)) json_out(400, ['error' => 'Bad request.']);
        $path = market_dir('providers') . "/$id.json"; $sub = json_file($path);
        if (!$sub || $sub['status'] !== 'pending') json_out(404, ['error' => 'No pending application with that id.']);
        if ($d === 'reject') {
            $sub = ['id' => $id, 'status' => 'rejected', 'created' => $sub['created'], 'name' => $sub['name'], 'type' => $sub['type'], 'rejected' => gmdate('c'), 'note' => clean_text($in['note'] ?? '', 200)];
            save_json($path, $sub); audit('prov-reject', ['provider' => $id]);
            json_out(200, ['ok' => true, 'message' => 'Rejected. The applicant\'s private details were deleted.']);
        }
        $checks = is_array($in['checks'] ?? null) ? $in['checks'] : [];
        $site = !empty($sub['website']) ? website_check($sub['website']) : null;
        $blockers = provider_blockers($sub, $checks, $site);
        if ($blockers) json_out(422, ['error' => 'Cannot publish yet.', 'blockers' => $blockers]);
        $flags = provider_flags($sub['name'] . ' ' . $sub['summary']);
        if (!empty($sub['website']) && $site && !$site['sameHost']) $flags[] = 'The website redirects to a different domain (' . $site['finalHost'] . ')';
        if ($flags && empty($in['override'])) json_out(409, ['error' => 'This application needs a second look.', 'flags' => $flags, 'needsOverride' => true]);
        $today = gmdate('Y-m-d'); $pubJson = provider_public($sub, $today);
        gh_commit_files(["src/content/providers/$id.json" => ['text' => json_encode($pubJson, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n"]], 'Add directory listing: ' . $sub['name'] . ' (admin)');
        $sub['status'] = 'approved'; $sub['approved'] = gmdate('c'); $sub['verification'] = ['emailLink' => !empty($sub['emailVerified']), 'emailManual' => !empty($checks['emailManual']), 'phone' => true, 'credential' => !empty($checks['credential']), 'website' => $site['ok'] ?? null, 'on' => $today];
        save_json($path, $sub); audit('prov-approve', ['provider' => $id, 'override' => !empty($in['override'])]);
        json_out(200, ['ok' => true, 'message' => 'Verified and published. It goes live after the next rebuild (a few minutes).']);
    }

    case 'prov_sponsor': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $id = need_str($in, 'id', 20); if (!valid_id($id)) json_out(400, ['error' => 'Bad request.']);
        $sub = json_file(market_dir('providers') . "/$id.json");
        if (!$sub || $sub['status'] !== 'approved') json_out(404, ['error' => 'Only a verified, live provider can be sponsored.']);
        if (!(PROVIDER_TYPES[$sub['type']][2] ?? false)) json_out(422, ['error' => 'This type of service cannot be advertised (health-related advertising is regulated).']);
        $file = "src/content/providers/$id.json"; $f = gh_file($file, 'main'); if (!$f) json_out(404, ['error' => 'Listing file not found on main.']);
        $pj = json_decode($f['text'], true); if (!is_array($pj) || ($pj['status'] ?? '') !== 'approved') json_out(422, ['error' => 'The listing is not live.']);
        if (($pj['reverifyBy'] ?? '') < gmdate('Y-m-d')) json_out(422, ['error' => 'Verification has expired. Re-verify the provider first.']);
        if (!empty($in['clear'])) {
            unset($pj['sponsored']);
            gh_commit_files([$file => ['text' => json_encode($pj, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n"]], 'End sponsorship: ' . $pj['name'] . ' (admin)');
            audit('prov-sponsor-clear', ['provider' => $id]); json_out(200, ['ok' => true, 'message' => 'Sponsorship ended.']);
        }
        $head = clean_text($in['headline'] ?? '', 60); $line = clean_text($in['line'] ?? '', 140);
        $from = (string)($in['from'] ?? ''); $until = (string)($in['until'] ?? '');
        $okDate = fn($d) => (bool)preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) && strtotime($d) !== false;
        $errs = [];
        if (mb_strlen($head) < 5) $errs[] = 'Headline must be 5 to 60 characters.';
        if (mb_strlen($line) < 15) $errs[] = 'Description must be 15 to 140 characters.';
        if (has_link($head . ' ' . $line)) $errs[] = 'No web links in the advert text; the provider\'s listed website is used.';
        if (!$okDate($from) || !$okDate($until) || $until < $from) $errs[] = 'Dates must be valid, with the end on or after the start.';
        elseif ((strtotime($until) - strtotime($from)) / 86400 > SPONSOR_MAX_DAYS) $errs[] = 'A sponsorship can run for at most ' . SPONSOR_MAX_DAYS . ' days.';
        elseif ($until > $pj['reverifyBy']) $errs[] = 'The sponsorship cannot run past the verification expiry (' . $pj['reverifyBy'] . ').';
        $af = provider_flags($head . ' ' . $line); foreach ($af as $x) $errs[] = 'Advert wording not allowed: ' . $x . '.';
        if ($errs) json_out(422, ['error' => 'Cannot sponsor yet.', 'blockers' => $errs]);
        $others = []; foreach (tree_index()['providers'] as $pid => $sha) { $o = blob_json($sha); if ($o) $others[] = $o; }
        $cand = $pj; $cand['sponsored'] = ['from' => $from, 'until' => $until, 'headline' => $head, 'line' => $line];
        $hit = sponsor_cap_hit($cand, $others);
        if ($hit) json_out(422, ['error' => 'Cannot sponsor yet.', 'blockers' => ["All " . SPONSOR_MAX_PER_DISTRICT_TYPE . " sponsored slots for this type in $hit are taken for those dates."]]);
        gh_commit_files([$file => ['text' => json_encode($cand, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n"]], 'Sponsor ' . $pj['name'] . ' ' . $from . ' to ' . $until . ' (admin)');
        audit('prov-sponsor', ['provider' => $id, 'from' => $from, 'until' => $until]);
        json_out(200, ['ok' => true, 'message' => 'Sponsored. It shows labelled as sponsored after the next rebuild.']);
    }

    case 'prov_status': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $id = need_str($in, 'id', 20); $to = need_str($in, 'status', 12);
        if (!valid_id($id) || !in_array($to, ['suspended', 'removed', 'approved', 'reverified'], true)) json_out(400, ['error' => 'Bad request.']);
        $path = market_dir('providers') . "/$id.json"; $sub = json_file($path);
        if (!$sub || !in_array($sub['status'], ['approved', 'suspended'], true)) json_out(404, ['error' => 'No live provider with that id.']);
        $file = "src/content/providers/$id.json"; $f = gh_file($file, 'main'); if (!$f) json_out(404, ['error' => 'Listing file not found on main.']);
        $pj = json_decode($f['text'], true); if (!is_array($pj)) json_out(422, ['error' => 'Listing file is not valid JSON.']);
        if ($to === 'reverified') {
            if (empty($in['confirmed'])) json_out(422, ['error' => 'Confirm that you called the business and re-checked the details.']);
            $today = gmdate('Y-m-d'); $pj['verifiedOn'] = $today; $pj['reverifyBy'] = gmdate('Y-m-d', time() + REVERIFY_DAYS * 86400); $pj['status'] = 'approved'; $sub['status'] = 'approved';
        } else { $pj['status'] = $to; if ($to !== 'approved') unset($pj['sponsored']); $sub['status'] = $to === 'removed' ? 'removed' : ($to === 'suspended' ? 'suspended' : 'approved'); }
        gh_commit_files([$file => ['text' => json_encode($pj, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n"]], ucfirst($to) . ': ' . $pj['name'] . ' (admin)');
        if ($to === 'removed') foreach (['contactPerson', 'contactPersonPhone', 'credentialNumber', 'phone', 'email', 'tokenHash'] as $k) $sub[$k] = '';
        save_json($path, $sub); audit('prov-' . $to, ['provider' => $id]);
        json_out(200, ['ok' => true, 'message' => $to === 'reverified' ? 'Re-verified for another 12 months.' : ($to === 'removed' ? 'Removed. Private details deleted.' : 'Updated.')]);
    }

    case 'prov_report_done': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $id = need_str($in, 'id', 20); if (!valid_id($id)) json_out(400, ['error' => 'Bad request.']);
        $path = market_dir('reports') . "/$id.json"; $r = json_file($path); if (!$r) json_out(404, ['error' => 'Not found.']);
        $r['status'] = 'closed'; $r['contactEmail'] = ''; $r['details'] = mb_substr($r['details'], 0, 0); $r['closed'] = gmdate('c');
        save_json($path, $r); audit('prov-report-done', ['report' => $id]); json_out(200, ['ok' => true]);
    }

    // ------------------------------------------------------------ which AI the agents use
    case 'agent_settings': {
        $f = gh_file('agents/settings.json', 'main'); $cfgJ = $f ? json_decode($f['text'], true) : [];
        if (!is_array($cfgJ)) $cfgJ = [];
        $last = gh_file('agents/reports/latest.md', 'main'); $lastRun = null;
        if ($last && preg_match('/^_Run:.*$/m', $last['text'], $m)) $lastRun = trim($m[0], "_ \r\n");
        // Which API keys exist? Needs the token's optional "Secrets: read" permission; otherwise unknown (null).
        $keys = null; $r = gh('GET', '/repos/' . repo() . '/actions/secrets', null, ['per_page' => 100]);
        if ($r[0] === 200 && is_array($r[1])) { $names = array_column($r[1]['secrets'] ?? [], 'name'); $keys = ['xai' => in_array('XAI_API_KEY', $names, true), 'openai' => in_array('OPENAI_API_KEY', $names, true), 'anthropic' => in_array('ANTHROPIC_API_KEY', $names, true)]; }
        json_out(200, ['provider' => $cfgJ['provider'] ?? 'auto', 'verifierProvider' => $cfgJ['verifierProvider'] ?? 'auto', 'lastRun' => $lastRun, 'keys' => $keys]);
    }

    case 'agent_settings_save': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $ok = ['auto', 'xai', 'openai', 'anthropic'];
        $prov = (string)($in['provider'] ?? ''); $ver = (string)($in['verifierProvider'] ?? '');
        if (!in_array($prov, $ok, true) || !in_array($ver, $ok, true)) json_out(400, ['error' => 'Choose auto, xai, openai or anthropic.']);
        $body = json_encode(['provider' => $prov, 'verifierProvider' => $ver, 'updated' => gmdate('Y-m-d')], JSON_PRETTY_PRINT) . "\n";
        gh_commit_files(['agents/settings.json' => ['text' => $body]], "Agents use $prov (verifier: $ver) (admin)");
        audit('agent-settings', ['provider' => $prov, 'verifier' => $ver]);
        json_out(200, ['ok' => true, 'message' => 'Saved. The next scheduled or manual run uses this choice.']);
    }

    case 'activity': {
        $f = data_dir() . '/admin-audit.log'; $lines = is_file($f) ? array_slice(file($f, FILE_IGNORE_NEW_LINES), -60) : [];
        json_out(200, ['events' => array_reverse(array_map(fn($l) => json_decode($l, true) ?: [], $lines))]);
    }

    default: json_out(404, ['error' => 'Unknown action.']);
    }
} catch (Throwable $e) {
    audit('error', ['msg' => substr($e->getMessage(), 0, 200)]);
    json_out(502, ['error' => $e->getMessage()]);
}
