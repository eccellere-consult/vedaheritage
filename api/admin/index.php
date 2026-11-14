<?php
// Admin API router. One endpoint: /api/admin/?a=<action>. JSON in, JSON out.
// Reads are GET, writes are POST with the session CSRF token. See docs/ADMIN.md.
define('VH_ADMIN', 1);
require __DIR__ . '/lib.php';
require_once __DIR__ . '/../lib/commerce.php';
require_once __DIR__ . '/../lib/accounts.php';

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


// ---------------------------------------------------------------- agent stop switch (agents/control.json on main)
const AGENT_JOBS = ['sprint' => 'sprint.yml', 'events' => 'events.yml', 'fetch-images' => 'fetch-images.yml', 'content-agents' => 'content-agents.yml'];

function control_read(): array {
    $f = gh_file('agents/control.json', 'main'); $c = $f ? json_decode($f['text'], true) : [];
    if (!is_array($c)) $c = [];
    $c['state'] = in_array($c['state'] ?? '', ['running', 'paused', 'killed'], true) ? $c['state'] : 'running';
    $c['agents'] = is_array($c['agents'] ?? null) ? $c['agents'] : [];
    return $c + ['reason' => '', 'by' => '', 'updated' => null];
}

function control_write(array $c, string $msg): void {
    $c['updated'] = gmdate('c');
    gh_commit_files(['agents/control.json' => ['text' => json_encode($c, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n"]], $msg);
}

/** Refuse to start an agent job while paused/killed or while that job is switched off. */
function control_gate(string $job): void {
    $c = control_read();
    if ($c['state'] !== 'running') json_out(409, ['error' => 'Agents are ' . $c['state'] . '. Resume them under Content sprint before starting a run.']);
    if (($c['agents'][$job] ?? true) === false) json_out(409, ['error' => ucfirst($job) . ' is switched off. Switch it on under Content sprint first.']);
}

function cancel_active_runs(): int {
    $n = 0;
    foreach (AGENT_JOBS as $wf) foreach (['in_progress', 'queued'] as $st) {
        $r = gh('GET', '/repos/' . repo() . "/actions/workflows/$wf/runs", null, ['status' => $st, 'per_page' => 10]);
        foreach (($r[1]['workflow_runs'] ?? []) as $x) { $c = gh('POST', '/repos/' . repo() . '/actions/runs/' . (int)$x['id'] . '/cancel'); if ($c[0] < 300) $n++; }
    }
    return $n;
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
        $ix = tree_index(); $draft = 0; $approved = 0; $toReview = 0;
        foreach ($ix['entries'] as $e) { $d = blob_json($e['sha']); if (($d['status'] ?? '') === 'approved') { $approved++; if (!empty($d['autoPublished']) && ($d['reviewed'] ?? null) !== true) $toReview++; } else $draft++; }
        $prs = gh_ok(gh('GET', '/repos/' . repo() . '/pulls', null, ['state' => 'open', 'per_page' => 30]), 'list PRs');
        $iss = gh_ok(gh('GET', '/repos/' . repo() . '/issues', null, ['labels' => 'story-submission', 'state' => 'open', 'per_page' => 50]), 'list stories');
        $stories = count(array_filter($iss, fn($i) => empty($i['pull_request']) && !in_array('approved', array_column($i['labels'] ?? [], 'name'), true)));
        json_out(200, ['drafts' => $draft, 'approved' => $approved, 'toReview' => $toReview, 'openPrs' => count($prs), 'stories' => $stories]);
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

    // ---- Owner tools used from the live site: edit, mark reviewed, delete (entries) and remove an event.
    case 'entry_save': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $cat = need_str($in, 'category', 30); $slug = need_str($in, 'slug', 80);
        if (!in_array($cat, CATS, true) || !valid_slug($slug) || !is_array($in['entry'] ?? null)) json_out(400, ['error' => 'Bad request.']);
        $path = "src/content/$cat/$slug.json"; $f = gh_file($path, 'main');
        if (!$f) json_out(404, ['error' => 'Entry not found.']);
        $old = json_decode($f['text'], true); $e = $in['entry'];
        if (($e['slug'] ?? '') !== $slug || ($e['category'] ?? '') !== $cat) json_out(422, ['error' => 'The slug and category cannot be changed.']);
        if (!is_array($old) || !isset($e['name']) || !is_string($e['name']) || trim($e['name']) === '') json_out(422, ['error' => 'The entry needs a name.']);
        $e['status'] = $old['status'] ?? 'draft';
        $judge = $e; $judge['status'] = 'draft';
        if ($b = publish_blockers($judge)) json_out(422, ['error' => 'Cannot save: ' . implode(' ', $b)]);
        $e['lastVerified'] = gmdate('Y-m-d'); $e['reviewed'] = true; $e['reviewedOn'] = gmdate('Y-m-d'); $e['ownerEdited'] = gmdate('Y-m-d');   // ownerEdited: agents never rewrite this page
        $txt = json_encode($e, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
        if (strlen($txt) > 200000) json_out(422, ['error' => 'Entry is too large.']);
        gh_commit_files([$path => ['text' => $txt]], 'Edit ' . $e['name'] . ' (admin)');
        audit('entry-save', ['entry' => "$cat/$slug"]);
        json_out(200, ['ok' => true, 'message' => 'Saved and marked reviewed. The site rebuilds and shows it in a few minutes.']);
    }

    case 'entry_reviewed': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $cat = need_str($in, 'category', 30); $slug = need_str($in, 'slug', 80);
        if (!in_array($cat, CATS, true) || !valid_slug($slug)) json_out(400, ['error' => 'Bad request.']);
        $path = "src/content/$cat/$slug.json"; $f = gh_file($path, 'main'); $e = $f ? json_decode($f['text'], true) : null;
        if (!is_array($e)) json_out(404, ['error' => 'Entry not found.']);
        $e['reviewed'] = true; $e['reviewedOn'] = gmdate('Y-m-d');
        gh_commit_files([$path => ['text' => json_encode($e, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n"]], 'Mark ' . ($e['name'] ?? $slug) . ' reviewed (admin)');
        audit('entry-reviewed', ['entry' => "$cat/$slug"]);
        json_out(200, ['ok' => true, 'message' => 'Marked as reviewed. The "not yet reviewed" note disappears after the next rebuild.']);
    }

    case 'entry_delete': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $cat = need_str($in, 'category', 30); $slug = need_str($in, 'slug', 80);
        if (!in_array($cat, CATS, true) || !valid_slug($slug)) json_out(400, ['error' => 'Bad request.']);
        $path = "src/content/$cat/$slug.json"; $f = gh_file($path, 'main'); $e = $f ? json_decode($f['text'], true) : null;
        if (!is_array($e)) json_out(404, ['error' => 'Entry not found.']);
        $del = [$path => null];
        if (gh_file("agents/evidence/$slug.json", 'main')) $del["agents/evidence/$slug.json"] = null;
        foreach (($e['images'] ?? []) as $im) if (is_array($im) && preg_match('~^/images/discover/' . preg_quote($slug, '~') . '-[A-Za-z0-9._-]+$~', $im['src'] ?? '')) $del['public' . $im['src']] = null;
        gh_commit_files($del, 'Delete ' . ($e['name'] ?? $slug) . ' (admin)');
        audit('entry-delete', ['entry' => "$cat/$slug", 'files' => count($del)]);
        json_out(200, ['ok' => true, 'message' => 'Deleted. The page disappears after the next rebuild. The agents will not re-add it.']);
    }

    case 'event_delete': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $id = need_str($in, 'id', 120); $path = 'src/content/events/calendar.json';
        $f = gh_file($path, 'main'); $c = $f ? json_decode($f['text'], true) : null;
        if (!is_array($c) || !is_array($c['events'] ?? null)) json_out(404, ['error' => 'No events calendar.']);
        $keep = array_values(array_filter($c['events'], fn($x) => ($x['id'] ?? '') !== $id));
        if (count($keep) === count($c['events'])) json_out(404, ['error' => 'Event not found.']);
        $c['events'] = $keep;
        gh_commit_files([$path => ['text' => json_encode($c, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n"]], 'Remove an event (admin)');
        audit('event-delete', ['id' => $id]);
        json_out(200, ['ok' => true, 'message' => 'Removed. The Events page updates after the next rebuild.']);
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
        if (isset(AGENT_JOBS[$w])) control_gate($w);   // the stop switch beats every manual start
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
        } elseif ($w === 'sprint') {
            $min = (string)($inp['minutes'] ?? '90'); if (!preg_match('/^([1-9][0-9]|1[0-7][0-9]|180)$/', $min)) json_out(400, ['error' => 'Minutes must be 10 to 180.']);
            $max = (string)($inp['max'] ?? '40'); if (!preg_match('/^([1-9]|[1-9][0-9]|1[0-9][0-9])$/', $max)) json_out(400, ['error' => 'Max topics per slice must be 1 to 199.']);
            $bud = (string)($inp['budget'] ?? '5'); if (!preg_match('/^([1-9]|[1-3][0-9]|40)$/', $bud)) json_out(400, ['error' => 'Budget must be 1 to 40 USD.']);
            $pv = (string)($inp['provider'] ?? 'saved'); if (!in_array($pv, ['saved', 'auto', 'xai', 'openai', 'anthropic'], true)) json_out(400, ['error' => 'Bad provider.']);
            $send = ['minutes' => $min, 'max' => $max, 'budget' => $bud, 'provider' => $pv]; $file = 'sprint.yml';
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
        foreach (['deploy.yml', 'sprint.yml', 'content-agents.yml', 'events.yml', 'fetch-images.yml'] as $wf) {
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
    case 'coverage_get': {
        $f = gh_file('agents/registers/coverage.json', 'main'); $c = $f ? json_decode($f['text'], true) : null;
        json_out(200, ['coverage' => is_array($c) ? $c : null, 'districts' => DISTRICTS]);
    }

    case 'agent_settings': {
        $f = gh_file('agents/settings.json', 'main'); $cfgJ = $f ? json_decode($f['text'], true) : [];
        if (!is_array($cfgJ)) $cfgJ = [];
        $last = gh_file('agents/reports/latest.md', 'main'); $lastRun = null;
        if ($last && preg_match('/^_Run:.*$/m', $last['text'], $m)) $lastRun = trim($m[0], "_ \r\n");
        // Which API keys exist? Needs the token's optional "Secrets: read" permission; otherwise unknown (null).
        $keys = null; $r = gh('GET', '/repos/' . repo() . '/actions/secrets', null, ['per_page' => 100]);
        if ($r[0] === 200 && is_array($r[1])) { $names = array_column($r[1]['secrets'] ?? [], 'name'); $keys = ['xai' => in_array('XAI_API_KEY', $names, true), 'openai' => in_array('OPENAI_API_KEY', $names, true), 'anthropic' => in_array('ANTHROPIC_API_KEY', $names, true)]; }
        $fs = gh_file('agents/registers/fill-state.json', 'main'); $fillState = $fs ? json_decode($fs['text'], true) : null;
        $qf = gh_file('agents/registers/quality.json', 'main'); $quality = $qf ? json_decode($qf['text'], true) : null;
        if (is_array($quality)) $quality['flagged'] = array_slice($quality['flagged'] ?? [], 0, 25);
        json_out(200, ['provider' => $cfgJ['provider'] ?? 'auto', 'verifierProvider' => $cfgJ['verifierProvider'] ?? 'auto', 'autoPublish' => ($cfgJ['autoPublish'] ?? false) === true, 'autoPublishExclude' => $cfgJ['autoPublishExclude'] ?? ['medical', 'healing'], 'fill' => array_merge(['everyDays' => 7, 'budget' => 5, 'max' => 40, 'minutes' => 90], is_array($cfgJ['fill'] ?? null) ? $cfgJ['fill'] : []), 'coverage' => array_merge(['enabled' => true, 'perCategory' => 30, 'perDistrictMin' => 2], is_array($cfgJ['coverage'] ?? null) ? $cfgJ['coverage'] : []), 'lastRun' => $lastRun, 'keys' => $keys, 'fillState' => is_array($fillState) ? $fillState : null, 'quality' => is_array($quality) ? $quality : null]);
    }

    case 'agent_settings_save': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $ok = ['auto', 'xai', 'openai', 'anthropic'];
        $f = gh_file('agents/settings.json', 'main'); $cur = $f ? json_decode($f['text'], true) : [];
        if (!is_array($cur)) $cur = [];
        $prov = (string)($in['provider'] ?? ($cur['provider'] ?? 'auto')); $ver = (string)($in['verifierProvider'] ?? ($cur['verifierProvider'] ?? 'auto'));
        if (!in_array($prov, $ok, true) || !in_array($ver, $ok, true)) json_out(400, ['error' => 'Choose auto, xai, openai or anthropic.']);
        $auto = array_key_exists('autoPublish', $in) ? ($in['autoPublish'] === true) : (($cur['autoPublish'] ?? false) === true);
        if (isset($in['fill']) && is_array($in['fill'])) {
            $fl = is_array($cur['fill'] ?? null) ? $cur['fill'] : [];
            foreach (['everyDays' => [1, 30], 'budget' => [1, 20], 'max' => [1, 100], 'minutes' => [10, 180]] as $k => $r) {
                if (!array_key_exists($k, $in['fill'])) continue;
                $v = $in['fill'][$k]; if (!is_numeric($v) || (int)$v != $v || $v < $r[0] || $v > $r[1]) json_out(400, ['error' => "$k must be a whole number from {$r[0]} to {$r[1]}."]);
                $fl[$k] = (int)$v;
            }
            $cur['fill'] = $fl;
        }
        if (isset($in['coverage']) && is_array($in['coverage'])) {
            $cv = array_merge(['enabled' => true, 'perCategory' => 30, 'perDistrictMin' => 2], is_array($cur['coverage'] ?? null) ? $cur['coverage'] : []);
            if (array_key_exists('enabled', $in['coverage'])) $cv['enabled'] = $in['coverage']['enabled'] === true;
            foreach (['perCategory' => [1, 100], 'perDistrictMin' => [0, 10]] as $k => $r) {
                if (!array_key_exists($k, $in['coverage'])) continue;
                $v = $in['coverage'][$k]; if (!is_numeric($v) || (int)$v != $v || $v < $r[0] || $v > $r[1]) json_out(400, ['error' => "$k must be a whole number from {$r[0]} to {$r[1]}."]);
                $cv[$k] = (int)$v;
            }
            $cur['coverage'] = $cv;
        }
        $cur['provider'] = $prov; $cur['verifierProvider'] = $ver; $cur['autoPublish'] = $auto; $cur['updated'] = gmdate('Y-m-d');
        if (!isset($cur['autoPublishExclude']) || !is_array($cur['autoPublishExclude'])) $cur['autoPublishExclude'] = ['medical', 'healing'];
        gh_commit_files(['agents/settings.json' => ['text' => json_encode($cur, JSON_PRETTY_PRINT) . "\n"]], "Agents use $prov (verifier: $ver), " . ($auto ? 'publish automatically' : 'review before publishing') . ' (admin)');
        audit('agent-settings', ['provider' => $prov, 'verifier' => $ver, 'autoPublish' => $auto]);
        json_out(200, ['ok' => true, 'autoPublish' => $auto, 'message' => $auto
            ? 'Saved. From the next run, entries that pass every check go live on their own and you review them on the site.'
            : 'Saved. From the next run, agent work waits for your approval under Review agent work.']);
    }

    // ---- Content sprint prototype: stop switch, topic register, dashboard data.
    case 'control_get': {
        $c = control_read(); $runs = [];
        foreach (AGENT_JOBS as $job => $wf) {
            $r = gh('GET', '/repos/' . repo() . "/actions/workflows/$wf/runs", null, ['per_page' => 3]);
            $x = ($r[1]['workflow_runs'] ?? [])[0] ?? null;
            $runs[] = ['job' => $job, 'file' => $wf, 'enabled' => ($c['agents'][$job] ?? true) !== false, 'status' => $x['status'] ?? null, 'conclusion' => $x['conclusion'] ?? null, 'when' => $x['created_at'] ?? null, 'url' => $x['html_url'] ?? null];
        }
        $tf = gh_file('agents/registers/topics.json', 'main'); $reg = $tf ? json_decode($tf['text'], true) : [];
        $topics = is_array($reg['topics'] ?? null) ? $reg['topics'] : [];
        $counts = []; foreach ($topics as $t) { $k = $t['status'] ?? 'todo'; $counts[$k] = ($counts[$k] ?? 0) + 1; }
        $ix = tree_index(); $needsImage = 0; $needsCheck = 0;
        foreach ($ix['entries'] as $e) { $d = blob_json($e['sha']); if (!$d) continue;
            if (($d['status'] ?? '') === 'approved' && empty($d['images'])) $needsImage++;
            if (($d['editorial']['status'] ?? '') === 'needs_fact_check') $needsCheck++; }
        $rep = gh_file('agents/reports/latest.md', 'main');
        json_out(200, ['control' => $c, 'runs' => $runs, 'counts' => $counts, 'topics' => $topics, 'needsImage' => $needsImage, 'needsFactCheck' => $needsCheck,
            'report' => $rep ? substr($rep['text'], 0, 6000) : '']);
    }

    case 'control_set': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $act = need_str($in, 'action', 12); $c = control_read();
        $reason = substr(trim(strip_tags((string)($in['reason'] ?? ''))), 0, 120);
        if ($act === 'pause' && $c['state'] === 'running') { $c['state'] = 'paused'; $msg = 'Pause all agents'; }
        elseif ($act === 'resume' && $c['state'] === 'paused') { $c['state'] = 'running'; $c['reason'] = ''; $msg = 'Resume all agents'; }
        elseif ($act === 'kill') { $c['state'] = 'killed'; $msg = 'KILL SWITCH: stop all agents'; }
        elseif ($act === 'reset' && $c['state'] === 'killed') {
            if (empty($in['confirm'])) json_out(400, ['error' => 'Resetting the kill switch needs confirmation.']);
            $c['state'] = 'running'; $c['reason'] = ''; $msg = 'Reset kill switch';
        } elseif ($act === 'job') {
            $job = need_str($in, 'job', 20); if (!isset(AGENT_JOBS[$job])) json_out(400, ['error' => 'Unknown job.']);
            $c['agents'][$job] = !empty($in['enabled']); $msg = ($c['agents'][$job] ? 'Switch on ' : 'Switch off ') . $job; $act = 'job:' . $job;
        } else json_out(409, ['error' => "Cannot $act while agents are " . $c['state'] . '.']);
        if (in_array($act, ['pause', 'kill'], true)) $c['reason'] = $reason;
        $c['by'] = 'admin';
        control_write($c, "$msg (admin)");
        $cancelled = ($act === 'kill') ? cancel_active_runs() : 0;
        audit('control', ['action' => $act, 'state' => $c['state'], 'cancelledRuns' => $cancelled]);
        json_out(200, ['ok' => true, 'state' => $c['state'], 'cancelledRuns' => $cancelled, 'message' => $act === 'kill'
            ? "Kill switch on. $cancelled running job(s) cancelled. Nothing more is written or published until you reset it." : 'Saved.']);
    }

    case 'topic_add': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $name = trim(strip_tags(need_str($in, 'name', 120))); $cat = need_str($in, 'category', 30); $dist = trim(strip_tags((string)($in['district'] ?? 'Kerala'))) ?: 'Kerala';
        $pri = max(1, min(3, (int)($in['priority'] ?? 2)));
        if (!in_array($cat, CATS, true) || strlen($name) < 3) json_out(400, ['error' => 'Give a topic name and a category.']);
        $tf = gh_file('agents/registers/topics.json', 'main'); $reg = $tf ? json_decode($tf['text'], true) : ['version' => 1, 'topics' => []];
        if (!is_array($reg) || !is_array($reg['topics'] ?? null)) $reg = ['version' => 1, 'topics' => []];
        $id = trim(preg_replace('~[^a-z0-9]+~', '-', strtolower($name)), '-'); $id = substr($id, 0, 80);
        foreach ($reg['topics'] as $t) if (($t['id'] ?? '') === $id) json_out(409, ['error' => 'That topic is already in the register.']);
        $reg['topics'][] = ['id' => $id, 'name' => $name, 'category' => $cat, 'district' => substr($dist, 0, 60), 'priority' => $pri, 'status' => 'todo', 'slug' => null, 'lastRun' => null, 'lastResult' => null, 'editorial' => null, 'nextReview' => null, 'imageStatus' => null, 'note' => ''];
        gh_commit_files(['agents/registers/topics.json' => ['text' => json_encode($reg, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n"]], "Add topic $name (admin)");
        audit('topic-add', ['id' => $id]); json_out(200, ['ok' => true, 'message' => 'Added. The next sprint picks it up.']);
    }

    case 'topic_set': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $id = need_str($in, 'id', 80); $st = need_str($in, 'status', 10);
        if (!in_array($st, ['todo', 'skipped'], true)) json_out(400, ['error' => 'Bad status.']);
        $tf = gh_file('agents/registers/topics.json', 'main'); $reg = $tf ? json_decode($tf['text'], true) : null;
        if (!is_array($reg) || !is_array($reg['topics'] ?? null)) json_out(404, ['error' => 'No topic register.']);
        $hit = false; foreach ($reg['topics'] as &$t) if (($t['id'] ?? '') === $id) { $t['status'] = $st; $hit = true; } unset($t);
        if (!$hit) json_out(404, ['error' => 'Topic not found.']);
        gh_commit_files(['agents/registers/topics.json' => ['text' => json_encode($reg, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n"]], "Topic $id: $st (admin)");
        audit('topic-set', ['id' => $id, 'status' => $st]); json_out(200, ['ok' => true, 'message' => $st === 'todo' ? 'Queued for the next sprint.' : 'Skipped.']);
    }

    // ------------------------------------------------------------ bookings module (locked until licences are recorded)
    case 'bk_overview': {
        $cfg = bk_config(); $caps = [];
        foreach (BK_CAPS as $id => $d) {
            $st = $cfg['caps'][$id] ?? [];
            $caps[] = ['id' => $id, 'label' => $d[0], 'about' => $d[1], 'buildable' => $d[2], 'enabled' => !empty($st['enabled']) && $d[2], 'open' => bk_open($id, $cfg),
                'missing' => bk_missing($id, $cfg), 'checklist' => array_map(fn($l) => $l, $d[3]), 'evidenceFields' => array_map(fn($e) => $e[0], $d[4]),
                'checked' => $st['checklist'] ?? new stdClass(), 'evidence' => $st['evidence'] ?? new stdClass(), 'updated' => $st['updated'] ?? null];
        }
        $partners = [];
        foreach (bk_providers() as $p) if (in_array($p['status'] ?? '', ['approved', 'suspended'], true) && in_array($p['type'] ?? '', BK_PARTNER_TYPES, true))
            $partners[] = ['id' => $p['id'], 'name' => $p['name'], 'type' => $p['type'], 'typeLabel' => PROVIDER_TYPES[$p['type']][0], 'districts' => $p['districts'], 'status' => $p['status'],
                'partner' => !empty($p['booking']['partner']), 'agreementOn' => $p['booking']['agreementOn'] ?? '', 'registrationChecked' => !empty($p['booking']['registrationChecked']),
                'fee' => bk_fee_clean($p['booking']['feeMode'] ?? null, $p['booking']['feeValue'] ?? null), 'live' => bk_partner_ok($p), 'test' => !empty($p['test']), 'email' => $p['email'] ?? '', 'inventory' => $p['inventory'] ?? new stdClass()];
        $items = []; foreach (glob(bk_dir('items') . '/*.json') ?: [] as $f) { $b = json_file($f); if (!$b) continue;
            // Abandoned payments: a stay hold that ran out, or a ride left unpaid for two days, is closed and its traveller details are deleted.
            if (($b['status'] ?? '') === 'pay_pending' && ((($b['kind'] ?? '') === 'stay' && ($b['holdUntil'] ?? 0) < time()) || (($b['kind'] ?? '') === 'ride' && strtotime($b['created']) < time() - 2 * 86400))) {
                $b['status'] = 'expired'; foreach (['contactEmail', 'contactPhone', 'message'] as $k) $b[$k] = ''; save_json($f, $b); }
            $items[] = $b; }
        usort($items, fn($x, $y) => strcmp($y['created'], $x['created']));
        foreach ($items as &$it) unset($it['payTokenHash'], $it['dispatch'], $it['otp']); unset($it);
        json_out(200, ['caps' => $caps, 'partners' => $partners, 'bookings' => array_slice($items, 0, 200), 'fee' => $cfg['fee'], 'gstRate' => $cfg['gstRate'], 'tcsPercent' => $cfg['tcsPercent'], 'tdsPercent' => $cfg['tdsPercent'], 'rideRates' => $cfg['rideRates'], 'vehicles' => RIDE_VEHICLES, 'districts' => DISTRICTS, 'mailLog' => mail_log_tail(12), 'notifyEmailValue' => (string)(vh_cfg()['notify_email'] ?? ''), 'rzpKeys' => rzp_keys_ok(), 'rzpTestKeys' => bk_test_keys(), 'testMode' => !empty($cfg['testMode']), 'notifyEmail' => !empty(vh_cfg()['notify_email'])]);
    }

    case 'bk_cap_save': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $cap = need_str($in, 'cap', 20); $def = BK_CAPS[$cap] ?? null; if (!$def) json_out(400, ['error' => 'Unknown capability.']);
        $cfg = bk_config(); $st = $cfg['caps'][$cap] ?? [];
        $ck = []; foreach ($def[3] as $k => $_) $ck[$k] = !empty($in['checklist'][$k]);
        $ev = []; foreach ($def[4] as $k => $_) $ev[$k] = clean_text($in['evidence'][$k] ?? '', 200);
        $st['checklist'] = $ck; $st['evidence'] = $ev; $st['updated'] = gmdate('c');
        if (bk_missing($cap, ['caps' => [$cap => $st]])) $st['enabled'] = false;   // changing the proof switches it off until it is complete again
        $cfg['caps'][$cap] = $st; bk_save($cfg); audit('bk-cap-save', ['cap' => $cap]);
        json_out(200, ['ok' => true, 'missing' => bk_missing($cap, $cfg), 'message' => 'Saved.']);
    }

    case 'bk_cap_set': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $cap = need_str($in, 'cap', 20); $def = BK_CAPS[$cap] ?? null; if (!$def) json_out(400, ['error' => 'Unknown capability.']);
        $cfg = bk_config(); $on = !empty($in['enabled']);
        if ($on) {
            if (!$def[2]) json_out(422, ['error' => 'This part is not built yet, so it cannot be switched on.', 'blockers' => ['The software for "' . $def[0] . '" does not exist yet.']]);
            $m = bk_missing($cap, $cfg); if ($m) json_out(422, ['error' => 'Cannot switch on yet.', 'blockers' => $m]);
        }
        $cfg['caps'][$cap]['enabled'] = $on; $cfg['caps'][$cap]['updated'] = gmdate('c'); bk_save($cfg); audit('bk-cap-' . ($on ? 'on' : 'off'), ['cap' => $cap]);
        json_out(200, ['ok' => true, 'message' => $on ? 'Switched on.' : 'Switched off.']);
    }

    case 'mail_test': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $to = trim((string)($in['to'] ?? '')); if (!valid_email($to)) json_out(400, ['error' => 'Give a valid email address.']);
        $ok = send_mail($to, 'Veda Heritage email test', "This is a test message from the Veda Heritage admin page.\n\nIf you can read it, the site can send email to this address. If it landed in spam, mark it as not spam.\n\nSent " . gmdate('Y-m-d H:i') . " UTC.");
        audit('mail-test', ['ok' => $ok]);
        json_out(200, ['ok' => true, 'sent' => $ok, 'message' => $ok ? 'Handed to the mail server. Check the inbox and the spam folder in a minute.' : 'The mail server refused the message. See the email log below.', 'log' => mail_log_tail(12)]);
    }

    case 'bk_testmode': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $cfg = bk_config(); $wasTest = !empty($cfg['testMode']); $cfg['testMode'] = !empty($in['enabled']); bk_save($cfg);
        if ($wasTest && !$cfg['testMode']) { $pd = vault_purge_test(); $pa = acct_purge_test(); audit('bk-testmode-purge', ['docs' => $pd, 'identities' => $pa]); }   // documents made with the throwaway test key cannot be read again, so they are deleted audit('bk-testmode', ['on' => $cfg['testMode']]);
        json_out(200, ['ok' => true, 'message' => $cfg['testMode'] ? 'Test mode is ON. Stays, rides and enquiries are open for testing. No email goes to partners or travellers, and online payments work only with Razorpay test keys.' : 'Test mode is OFF. Every capability is locked again until its approvals are recorded and it is switched on.']);
    }

    case 'bk_test_partner': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        if (!bk_test()) json_out(403, ['error' => 'Switch test mode on first. Test partners exist only for testing.']);
        if (!empty($in['remove'])) {
            $id = need_str($in, 'id', 20); $path = market_dir('providers') . "/$id.json"; $p = valid_id($id) ? json_file($path) : null;
            if (!$p || empty($p['test'])) json_out(404, ['error' => 'No test partner with that id.']);
            @unlink($path); audit('bk-test-partner-remove', ['id' => $id]); json_out(200, ['ok' => true, 'message' => 'Test partner removed.']);
        }
        $name = clean_text($in['name'] ?? '', 80); $type = (string)($in['type'] ?? ''); $dist = (string)($in['district'] ?? '');
        if (mb_strlen($name) < 3 || !in_array($type, BK_PARTNER_TYPES, true) || !in_array($dist, DISTRICTS, true)) json_out(400, ['error' => 'Give a name, choose stay or transport, and choose a district.']);
        $id = new_id(); $owner = (string)(vh_cfg()['notify_email'] ?? 'test@example.com');
        if (strpos($owner, '@') !== false) $owner = preg_replace('/^([^@+]+)(\+[^@]*)?@/', '$1+test' . substr($id, -4) . '@', $owner);   // a unique address per test partner, so portal sign-in finds the right one
        save_json(market_dir('providers') . "/$id.json", ['id' => $id, 'status' => 'approved', 'created' => gmdate('c'), 'test' => true, 'name' => $name . ' (TEST)', 'type' => $type, 'districts' => [$dist],
            'summary' => 'A test partner created for trying the booking features. It is not a real business and is never listed publicly.', 'phone' => '+910000000000', 'email' => $owner, 'website' => '', 'address' => '',
            'credentialKind' => '', 'credentialNumber' => '', 'contactPerson' => 'Test', 'contactPersonPhone' => '', 'emailVerified' => true, 'booking' => ['partner' => true, 'agreementOn' => gmdate('Y-m-d'), 'registrationChecked' => true]]);
        audit('bk-test-partner-add', ['id' => $id]);
        json_out(200, ['ok' => true, 'message' => 'Test partner added and switched on. Open it below to add rooms (stay) or vehicles (transport).']);
    }

    case 'bk_settings': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $cfg = bk_config(); $g = $in['gstRate'] ?? null;
        $fee = bk_fee_clean($in['feeMode'] ?? null, $in['feeValue'] ?? null);
        if (!$fee) json_out(400, ['error' => 'Choose a percentage (0 to 20) or a flat amount per booking (0 to 5000 rupees).']);
        if (!is_numeric($g) || $g < 0 || $g > 40) json_out(400, ['error' => 'GST rate must be 0 to 40 percent.']);
        $tcs = $in['tcsPercent'] ?? 0; $tds = $in['tdsPercent'] ?? 0;
        if (!is_numeric($tcs) || $tcs < 0 || $tcs > 10 || !is_numeric($tds) || $tds < 0 || $tds > 10) json_out(400, ['error' => 'TCS and TDS must be 0 to 10 percent. Set them only on your accountant\'s advice.']);
        if (isset($in['rideRates'])) {
            if (!is_array($in['rideRates'])) json_out(400, ['error' => 'Bad ride rates.']);
            $rr = [];
            foreach (RIDE_VEHICLES as $k => $_) {
                $r = $in['rideRates'][$k] ?? null; if ($r === null) continue;
                foreach (['baseInr' => [0, 2000], 'perKmInr' => [0, 200], 'minInr' => [0, 5000], 'nightPct' => [0, 100]] as $f => $lim)
                    if (!is_numeric($r[$f] ?? null) || $r[$f] < $lim[0] || $r[$f] > $lim[1]) json_out(400, ['error' => "Ride rate $k: $f must be a number from {$lim[0]} to {$lim[1]}."]);
                $rr[$k] = ['baseInr' => (float)$r['baseInr'], 'perKmInr' => (float)$r['perKmInr'], 'minInr' => (float)$r['minInr'], 'nightPct' => (float)$r['nightPct']];
            }
            $cfg['rideRates'] = $rr;
        }
        $cfg['fee'] = $fee; $cfg['gstRate'] = round((float)$g, 2); $cfg['tcsPercent'] = round((float)$tcs, 2); $cfg['tdsPercent'] = round((float)$tds, 2); unset($cfg['commissionRate']); bk_save($cfg); audit('bk-settings', ['fee' => $fee['mode'] . ':' . $fee['value']]);
        json_out(200, ['ok' => true, 'message' => 'Saved: ' . bk_fee_label($fee) . '. New bookings use it; earlier ones keep theirs.']);
    }

    case 'bk_inventory_set': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $id = need_str($in, 'id', 20); if (!valid_id($id)) json_out(400, ['error' => 'Bad request.']);
        $path = market_dir('providers') . "/$id.json"; $p = json_file($path);
        if (!$p || !in_array($p['type'] ?? '', BK_PARTNER_TYPES, true)) json_out(404, ['error' => 'No stay or transport provider with that id.']);
        [$inv, $ierr] = bk_inventory_apply($p, $in, true); if ($ierr) json_out(400, ['error' => $ierr]);
        $p['inventory'] = $inv; save_json($path, $p); audit('bk-inventory', ['provider' => $id]);
        json_out(200, ['ok' => true, 'message' => 'Saved.']);
    }

    case 'bk_pay_action': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $id = need_str($in, 'id', 20); $act = need_str($in, 'action', 10); if (!valid_id($id)) json_out(400, ['error' => 'Bad request.']);
        if (!bk_open('payments')) json_out(403, ['error' => 'Online payments are locked.']);
        if ($act === 'release') { [$ok, $m] = pay_release($id); audit('bk-release', ['id' => $id, 'ok' => $ok]); json_out($ok ? 200 : 422, $ok ? ['ok' => true, 'message' => $m] : ['error' => $m]); }
        if ($act === 'refund') { $amt = ($in['amountInr'] ?? '') === '' || ($in['amountInr'] ?? null) === null ? null : (is_numeric($in['amountInr']) ? (float)$in['amountInr'] : -1); [$ok, $m] = pay_refund($id, $amt); audit('bk-refund', ['id' => $id, 'ok' => $ok]); json_out($ok ? 200 : 422, $ok ? ['ok' => true, 'message' => $m] : ['error' => $m]); }
        if ($act === 'retry') { $b = bk_load($id); if (!$b) json_out(404, ['error' => 'Not found.']); $b = pay_transfer($b); json_out(200, ['ok' => true, 'message' => !empty($b['payment']['transferId']) ? 'Payout transfer created.' : 'The transfer could not be created yet. Check the partner account ID.']); }
        json_out(400, ['error' => 'Unknown action.']);
    }

    case 'bk_partner_set': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $id = need_str($in, 'id', 20); if (!valid_id($id)) json_out(400, ['error' => 'Bad request.']);
        $path = market_dir('providers') . "/$id.json"; $p = json_file($path);
        if (!$p || !in_array($p['status'] ?? '', ['approved', 'suspended'], true)) json_out(404, ['error' => 'No verified provider with that id.']);
        if (!in_array($p['type'] ?? '', BK_PARTNER_TYPES, true)) json_out(422, ['error' => 'Only stays and transport providers can be booking partners.']);
        $on = !empty($in['partner']); $d = (string)($in['agreementOn'] ?? ''); $reg = !empty($in['registrationChecked']);
        $fee = null;
        if (($in['feeValue'] ?? '') !== '' && ($in['feeValue'] ?? null) !== null) { $fee = bk_fee_clean($in['feeMode'] ?? null, $in['feeValue']); if (!$fee) json_out(400, ['error' => 'The partner fee must be a percentage (0 to 20) or a flat amount (0 to 5000 rupees).']); }
        if ($on && !bk_test()) {
            $b = [];
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) || strtotime($d) === false) $b[] = 'Enter the date the written agreement was signed.';
            if (!$reg) $b[] = 'Confirm you checked the partner\'s registration or permit' . ($p['type'] === 'stay' ? ' (Kerala Tourism classification or registration)' : ' (taxi or auto permit and driver licence)') . '.';
            if (($p['status'] ?? '') !== 'approved') $b[] = 'The provider is suspended.';
            if ($b) json_out(422, ['error' => 'Cannot switch this partner on yet.', 'blockers' => $b]);
        }
        $p['booking'] = ['partner' => $on, 'agreementOn' => $d, 'registrationChecked' => $reg, 'feeMode' => $fee['mode'] ?? null, 'feeValue' => $fee['value'] ?? null];
        save_json($path, $p); audit('bk-partner', ['provider' => $id, 'on' => $on]);
        json_out(200, ['ok' => true, 'message' => $on ? (bk_test() ? 'Partner switched on for testing (the agreement and registration check are not needed in test mode, and the partner will not be live without them once test mode is off).' : 'Partner switched on. They show for booking requests once Partner enquiries is open.') : 'Partner switched off.']);
    }

    case 'bk_send': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $id = need_str($in, 'id', 20); if (!valid_id($id)) json_out(400, ['error' => 'Bad request.']);
        $path = bk_dir('items') . "/$id.json"; $b = json_file($path); if (!$b) json_out(404, ['error' => 'Not found.']);
        if (!in_array($b['status'], ['new', 'sent'], true)) json_out(422, ['error' => 'This request is already ' . $b['status'] . '.']);
        $p = json_file(market_dir('providers') . '/' . $b['providerId'] . '.json');
        if (!$p || !bk_partner_ok($p)) json_out(422, ['error' => 'This partner is not switched on any more.']);
        $contact = trim(($b['contactPhone'] ?? '') . ' ' . ($b['contactEmail'] ?? ''));
        $ok = bk_mail($p['email'], 'Veda Heritage booking request ' . $b['ref'],
            "Booking request {$b['ref']}\n\nTraveller: {$b['name']} ($contact)\nDates: {$b['checkIn']} to {$b['checkOut']}\nPeople: {$b['people']}\n\nTraveller's message and plan:\n{$b['message']}\n\nPlease contact the traveller directly to confirm. Payment is made to you on site. Quote {$b['ref']} in your confirmation and tell Veda Heritage if the booking goes ahead.\n\nVeda Heritage");
        $b['status'] = 'sent'; $b['sentOn'] = gmdate('c'); save_json($path, $b); audit('bk-send', ['ref' => $b['ref']]);
        json_out(200, ['ok' => true, 'emailed' => $ok, 'message' => $ok ? 'Sent to the partner by email.' : 'Marked as sent, but the email could not be sent. Contact the partner yourself.']);
    }

    case 'bk_status': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $id = need_str($in, 'id', 20); $to = need_str($in, 'status', 12);
        if (!valid_id($id) || !in_array($to, BK_STATUSES, true)) json_out(400, ['error' => 'Bad request.']);
        $path = bk_dir('items') . "/$id.json"; $b = json_file($path); if (!$b) json_out(404, ['error' => 'Not found.']);
        $cfg = bk_config();
        if ($to === 'completed') {
            $v = $in['valueInr'] ?? null; $hasV = is_numeric($v) && $v > 0;
            if ($v !== null && $v !== '' && (!is_numeric($v) || $v < 0 || $v > 5000000)) json_out(422, ['error' => 'The booking value must be a number in rupees.']);
            if ($hasV) $b['valueInr'] = round((float)$v, 2);
            if (bk_open('commission', $cfg) && ($b['payment']['mode'] ?? '') !== 'online') {
                $p = json_file(market_dir('providers') . '/' . $b['providerId'] . '.json');
                $fee = $p ? bk_fee_for($p, $cfg) : $cfg['fee'];
                if ($fee['mode'] === 'percent' && !$hasV) json_out(422, ['error' => 'Enter the booking value in rupees (the partner confirms it). The fee is a percentage of it.']);
                $b['feeMode'] = $fee['mode']; $b['feeValue'] = $fee['value']; $b['commissionInr'] = bk_commission($hasV ? (float)$b['valueInr'] : null, $fee);
            }
            $b['completedOn'] = gmdate('Y-m-d');
        }
        $b['status'] = $to; $b['note'] = clean_text($in['note'] ?? ($b['note'] ?? ''), 300);
        if (in_array($to, ['completed', 'cancelled', 'declined'], true)) foreach (['contactEmail', 'contactPhone', 'message'] as $k) $b[$k] = '';   // data minimisation: keep the reference, drop the traveller's details
        save_json($path, $b); audit('bk-status', ['ref' => $b['ref'], 'to' => $to]);
        if ($to === 'completed' && !empty($b['payment']['transferId']) && !empty($b['payment']['payoutHeld'])) pay_release($id);
        json_out(200, ['ok' => true, 'commissionInr' => $b['commissionInr'] ?? null, 'message' => 'Updated.' . (in_array($to, ['completed', 'cancelled', 'declined'], true) ? ' The traveller\'s contact details were deleted.' : '')]);
    }

    case 'bk_settlement': {
        $cfg = bk_config(); if (!bk_open('commission', $cfg)) json_out(403, ['error' => 'Commission and settlement are locked. Record the approvals and switch it on first.']);
        $m = (string)($_GET['month'] ?? gmdate('Y-m')); if (!preg_match('/^\d{4}-\d{2}$/', $m)) json_out(400, ['error' => 'Month must look like 2026-11.']);
        $rows = bk_settlement($m, $cfg);
        json_out(200, ['month' => $m, 'rows' => $rows, 'csv' => bk_csv($rows, $m), 'gstRate' => $cfg['gstRate'],
            'totals' => ['commissionInr' => round(array_sum(array_column($rows, 'commissionInr')), 2), 'gstInr' => round(array_sum(array_column($rows, 'gstInr')), 2), 'totalDueInr' => round(array_sum(array_column($rows, 'totalDueInr')), 2)]]);
    }

    case 'bk_settle': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $cfg = bk_config(); if (!bk_open('commission', $cfg)) json_out(403, ['error' => 'Commission and settlement are locked.']);
        $pid = need_str($in, 'providerId', 20); $m = need_str($in, 'month', 7); $ref = clean_text($in['reference'] ?? '', 60);
        if (!valid_id($pid) || !preg_match('/^\d{4}-\d{2}$/', $m) || mb_strlen($ref) < 3) json_out(400, ['error' => 'Give the month and the payment or invoice reference.']);
        $n = 0; foreach (glob(bk_dir('items') . '/*.json') ?: [] as $f) { $b = json_file($f);
            if ($b && $b['providerId'] === $pid && ($b['status'] ?? '') === 'completed' && substr($b['completedOn'] ?? '', 0, 7) === $m && empty($b['settled'])) { $b['settled'] = true; $b['settledRef'] = $ref; $b['settledOn'] = gmdate('Y-m-d'); save_json($f, $b); $n++; } }
        audit('bk-settle', ['provider' => $pid, 'month' => $m, 'n' => $n]);
        json_out(200, ['ok' => true, 'message' => "$n booking(s) marked as settled."]);
    }

    // ------------------------------------------------------------ identity verification (documents, locations, travellers)
    case 'kyc_overview': {
        kyc_purge_all(); $provs = [];
        foreach (bk_providers() as $p) {
            if (!in_array($p['type'] ?? '', BK_PARTNER_TYPES, true) || !in_array($p['status'] ?? '', ['approved', 'suspended'], true)) continue;
            $v = prov_verification($p); $docs = [];
            foreach (($p['verification']['docs'] ?? []) as $d) { $m = vault_meta($d['docId']); $docs[] = ['docId' => $d['docId'], 'docType' => $d['docType'], 'label' => PROV_DOC_TYPES[$d['docType']] ?? $d['docType'], 'status' => $d['status'], 'expires' => $d['expires'] ?? null, 'note' => $d['note'] ?? '', 'uploadedOn' => $d['uploadedOn'] ?? '', 'size' => $m['size'] ?? 0, 'kind' => $m['kind'] ?? '', 'needsExpiry' => in_array($d['docType'], PROV_EXPIRY_REQUIRED, true)]; }
            $g = $p['verification']['geo'] ?? null;
            $provs[] = ['id' => $p['id'], 'name' => $p['name'], 'type' => $p['type'], 'districts' => $p['districts'], 'test' => !empty($p['test']), 'verified' => $v['ok'], 'missing' => $v['missing'], 'docs' => $docs, 'required' => PROV_REQUIRED[$p['type']] ?? [],
                'geo' => $g ? $g + ['map' => 'https://www.openstreetmap.org/?mlat=' . $g['lat'] . '&mlon=' . $g['lng'] . '#map=17/' . $g['lat'] . '/' . $g['lng']] : null, 'address' => $p['address'] ?? ''];
        }
        $acs = acct_all(); $trav = []; $withId = 0; $foreign = 0; $docsN = 0;
        foreach ($acs as $a) { $n = count(vault_owned('account', $a['id'])); $docsN += $n; if (!empty($a['identityEnc'])) $withId++; if (($a['residency'] ?? '') === 'foreign') $foreign++; $trav[] = ['id' => $a['id'], 'email' => $a['email'], 'name' => $a['name'] ?? '', 'residency' => $a['residency'] ?? '', 'verified' => !empty($a['verified']), 'identityOn' => $a['identityOn'] ?? null, 'docs' => $n, 'created' => $a['created']]; }
        usort($trav, fn($x, $y) => strcmp($y['created'], $x['created']));
        json_out(200, ['providers' => $provs, 'travellers' => array_slice($trav, 0, 100), 'stats' => ['accounts' => count($acs), 'withIdentity' => $withId, 'foreign' => $foreign, 'documents' => $docsN],
            'retentionDays' => (int)bk_config()['kycRetentionDays'], 'vaultReady' => vault_ready(), 'realKey' => vault_real_key(), 'kycOpen' => bk_open('kyc'), 'audit' => vault_audit_tail(60), 'docLabels' => PROV_DOC_TYPES]);
    }

    case 'kyc_doc_view': {
        $m = vault_meta((string)($_GET['id'] ?? '')); $reason = clean_text($_GET['reason'] ?? '', 200);
        if (!$m) json_out(404, ['error' => 'Not found.']); if (mb_strlen($reason) < 5) json_out(400, ['error' => 'Say why you are opening this document (at least 5 characters). It is written to the audit log.']);
        $d = vault_get($m['id']); if (!$d) json_out(500, ['error' => 'Could not open the file. Check that doc_key in vh-config.php has not changed.']);
        vault_audit('admin', 'doc_view', $m['owner']['type'] . ':' . $m['owner']['id'] . ':' . $m['id'], $reason);
        json_out(200, ['ok' => true, 'mime' => $m['mime'], 'data' => base64_encode($d['bytes'])]);
    }

    case 'kyc_doc_decide': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $pid = need_str($in, 'providerId', 20); $did = need_str($in, 'docId', 20); $dec = need_str($in, 'decision', 10); if (!valid_id($pid) || !in_array($dec, ['approve', 'reject'], true)) json_out(400, ['error' => 'Bad request.']);
        $path = market_dir('providers') . "/$pid.json"; $p = json_file($path); if (!$p) json_out(404, ['error' => 'Provider not found.']);
        $docs = $p['verification']['docs'] ?? []; $hit = false; $note = clean_text($in['note'] ?? '', 200); $exp = trim((string)($in['expires'] ?? ''));
        foreach ($docs as &$d) if ($d['docId'] === $did) {
            $hit = true;
            if ($dec === 'approve') {
                if ($exp !== '' && (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $exp) || strtotime($exp) === false)) json_out(400, ['error' => 'The expiry date must be YYYY-MM-DD.']);
                if ($exp !== '' && $exp < gmdate('Y-m-d')) json_out(422, ['error' => 'This document has already expired.']);
                if ($exp === '' && in_array($d['docType'], PROV_EXPIRY_REQUIRED, true)) json_out(422, ['error' => 'Enter the expiry date shown on the document.']);
                $d['status'] = 'approved'; $d['expires'] = $exp === '' ? null : $exp; $d['note'] = $note;
            } else { if ($note === '') json_out(422, ['error' => 'Say what is wrong so the partner can fix it.']); $d['status'] = 'rejected'; $d['note'] = $note; }
            $d['decidedOn'] = gmdate('Y-m-d');
        } unset($d);
        if (!$hit) json_out(404, ['error' => 'Document not found.']);
        $p['verification']['docs'] = $docs; save_json($path, $p); audit('kyc-doc-' . $dec, ['provider' => $pid, 'doc' => $did]);
        json_out(200, ['ok' => true, 'message' => $dec === 'approve' ? 'Approved.' : 'Rejected. The partner sees your note.']);
    }

    case 'kyc_geo_decide': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $pid = need_str($in, 'providerId', 20); $dec = need_str($in, 'decision', 10); if (!valid_id($pid) || !in_array($dec, ['approve', 'reject'], true)) json_out(400, ['error' => 'Bad request.']);
        $path = market_dir('providers') . "/$pid.json"; $p = json_file($path); if (!$p || empty($p['verification']['geo'])) json_out(404, ['error' => 'No location to review.']);
        $note = clean_text($in['note'] ?? '', 200); if ($dec === 'reject' && $note === '') json_out(422, ['error' => 'Say what is wrong.']);
        $p['verification']['geo']['status'] = $dec === 'approve' ? 'approved' : 'rejected'; $p['verification']['geo']['note'] = $note; save_json($path, $p); audit('kyc-geo-' . $dec, ['provider' => $pid]);
        json_out(200, ['ok' => true, 'message' => $dec === 'approve' ? 'Location approved.' : 'Location rejected.']);
    }

    case 'kyc_settings': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $d = $in['retentionDays'] ?? null; if (!is_numeric($d) || (int)$d != $d || $d < 7 || $d > 730) json_out(400, ['error' => 'Retention must be 7 to 730 days.']);
        $cfg = bk_config(); $cfg['kycRetentionDays'] = (int)$d; bk_save($cfg); audit('kyc-settings', ['days' => (int)$d]);
        json_out(200, ['ok' => true, 'message' => 'Saved. New uploads are deleted after ' . (int)$d . ' days; identity details saved earlier follow this period too.']);
    }

    case 'kyc_purge': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $r = kyc_purge_all(); audit('kyc-purge', $r); json_out(200, ['ok' => true, 'message' => $r['docs'] . ' expired document(s) and ' . $r['identities'] . ' old identity record(s) deleted.']);
    }

    case 'kyc_keygen': {
        json_out(200, ['key' => base64_encode(random_bytes(32)), 'how' => "Add this line to vh-config.php (before the closing ];), save, then keep a safe copy of the key somewhere private. If the key is lost, stored documents cannot be opened:\n'doc_key' => 'PASTE_THE_KEY_HERE',"]);
    }

    case 'kyc_traveller_view': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $id = need_str($in, 'id', 20); $reason = clean_text($in['reason'] ?? '', 200); $a = acct_load($id);
        if (!$a) json_out(404, ['error' => 'Not found.']); if (mb_strlen($reason) < 5) json_out(400, ['error' => 'Say why you are opening this record (at least 5 characters). It is written to the audit log.']);
        vault_audit('admin', 'traveller_view', $id, $reason);
        json_out(200, ['ok' => true, 'email' => $a['email'], 'name' => $a['name'] ?? '', 'identity' => acct_identity($a), 'docs' => array_map(fn($m) => ['id' => $m['id'], 'label' => ACCT_DOC_TYPES[$m['docType']] ?? $m['docType'], 'created' => $m['created']], vault_owned('account', $id))]);
    }

    case 'kyc_traveller_erase': {
        if ($method !== 'POST') json_out(405, ['error' => 'POST only.']);
        $id = need_str($in, 'id', 20); $a = acct_load($id); if (!$a) json_out(404, ['error' => 'Not found.']); if (($in['confirm'] ?? '') !== 'DELETE') json_out(422, ['error' => 'Type DELETE to confirm.']);
        vault_audit('admin', 'traveller_erased', $id, clean_text($in['reason'] ?? 'data deletion request', 200)); acct_erase($a); json_out(200, ['ok' => true, 'message' => 'The account, itineraries and documents were deleted.']);
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
