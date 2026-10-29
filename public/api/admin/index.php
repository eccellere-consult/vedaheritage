<?php
// Admin API router. One endpoint: /api/admin/?a=<action>. JSON in, JSON out.
// Reads are GET, writes are POST with the session CSRF token. See docs/ADMIN.md.
define('VH_ADMIN', 1);
require __DIR__ . '/lib.php';

$a = preg_replace('/[^a-z_]/', '', $_GET['a'] ?? '');
$method = $_SERVER['REQUEST_METHOD'];
$in = $method === 'POST' ? read_json() : [];

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
    $entries = []; $evidence = [];
    $cats = implode('|', CATS);
    foreach ($t['tree'] ?? [] as $n) {
        if (($n['type'] ?? '') !== 'blob') continue;
        if (preg_match('~^src/content/(' . $cats . ')/([a-z0-9-]+)\.json$~', $n['path'], $m)) $entries[] = ['cat' => $m[1], 'slug' => $m[2], 'path' => $n['path'], 'sha' => $n['sha']];
        elseif (preg_match('~^agents/evidence/([a-z0-9-]+)\.json$~', $n['path'], $m)) $evidence[$m[1]] = $n['sha'];
    }
    $out = ['entries' => $entries, 'evidence' => $evidence, 'head' => $t['sha'] ?? ''];
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
    json_out(200, [
        'authed' => $authed, 'csrf' => $authed ? ($_SESSION['csrf'] ?? '') : '',
        'configured' => (bool)(cfg()['admin_password_hash'] ?? '') && (bool)(cfg()['admin_github_token'] ?? (cfg()['github_token'] ?? '')),
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
            $send = ['command' => $cmd, 'max' => $max, 'budget' => $bud] + ($slugs !== '' ? ['slugs' => $slugs] : []);
            $file = 'content-agents.yml';
        } elseif ($w === 'fetch-images') {
            $slug = (string)($inp['slug'] ?? ''); if ($slug !== '' && !valid_slug($slug)) json_out(400, ['error' => 'Bad slug.']);
            $send = ($slug !== '' ? ['slug' => $slug] : []) + ['force' => !empty($inp['force']) ? 'true' : 'false'];
            $file = 'fetch-images.yml';
        } elseif ($w === 'link-check') { $file = 'link-check.yml'; }
        else json_out(400, ['error' => 'Unknown workflow.']);
        $r = gh('POST', '/repos/' . repo() . "/actions/workflows/$file/dispatches", ['ref' => 'main'] + ($send ? ['inputs' => $send] : []));
        gh_ok($r, 'start workflow');
        audit('run-workflow', ['workflow' => $w, 'inputs' => $send]);
        json_out(200, ['ok' => true, 'message' => 'Started. Agent runs take about 15 to 20 minutes; a pull request appears when they finish.']);
    }

    case 'site': {
        $runs = [];
        foreach (['deploy.yml', 'content-agents.yml', 'fetch-images.yml'] as $wf) {
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
