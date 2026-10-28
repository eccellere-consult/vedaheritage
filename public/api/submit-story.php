<?php
// Receives traveller stories from /stories and /discover/* and files them as a
// GitHub issue labelled "story-submission" for the twice-weekly review.
//
// Setup (once, on Hostinger): create /domains/vedaheritage.co.in/vh-config.php
// OUTSIDE public_html with:
//   <?php return ['github_token' => 'ghp_xxx', 'repo' => 'eccellere-consult/vedaheritage',
//                 'notify_email' => 'stay@vedaheritage.co.in'];
// The token needs only "Issues: write" on this one repository.

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function out(int $code, array $body): void { http_response_code($code); echo json_encode($body); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(405, ['ok' => false, 'error' => 'POST only.']);

$raw = file_get_contents('php://input', false, null, 0, 20000);
$in = json_decode($raw, true);
if (!is_array($in)) out(400, ['ok' => false, 'error' => 'Invalid request.']);

// Honeypot: bots fill the hidden field. Pretend success.
if (!empty($in['website'])) out(200, ['ok' => true]);

// Simple per-IP rate limit: 5 submissions per hour.
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rl = sys_get_temp_dir() . '/vh_story_' . hash('sha256', $ip);
$hits = is_file($rl) ? array_filter(array_map('intval', file($rl, FILE_IGNORE_NEW_LINES)), fn($t) => $t > time() - 3600) : [];
if (count($hits) >= 5) out(429, ['ok' => false, 'error' => 'Too many submissions. Please try again later.']);

function clean(?string $v, int $max): string {
    $v = trim(strip_tags((string)$v));
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $v);
    return mb_substr($v, 0, $max);
}

$types = ['Experience', 'Folklore I heard', 'Travel tip'];
$cats  = ['temples', 'places', 'beaches', 'backwaters', 'ayurveda'];

$story = [
    'type'   => in_array($in['type'] ?? '', $types, true) ? $in['type'] : 'Experience',
    'title'  => clean($in['title'] ?? '', 120),
    'body'   => clean($in['body'] ?? '', 4000),
    'author' => clean($in['author'] ?? '', 60),
    'origin' => clean($in['origin'] ?? '', 60),
];
$cat  = $in['entryCategory'] ?? '';
$slug = $in['entrySlug'] ?? '';
if (in_array($cat, $cats, true) && preg_match('/^[a-z0-9-]{1,80}$/', $slug)) {
    $story['entryCategory'] = $cat;
    $story['entrySlug'] = $slug;
}
if (empty($in['consent']) || $story['title'] === '' || $story['author'] === '' || mb_strlen($story['body']) < 40) {
    out(422, ['ok' => false, 'error' => 'Please complete all required fields.']);
}
if (preg_match('~https?://|www\.~i', $story['body'] . $story['title'])) {
    out(422, ['ok' => false, 'error' => 'Please leave out web links.']);
}

$hits[] = time();
file_put_contents($rl, implode("\n", $hits));

$cfgFile = dirname(__DIR__, 2) . '/vh-config.php';
$cfg = is_file($cfgFile) ? require $cfgFile : [];
$json = json_encode($story, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
$issueBody = "Submitted via website. Review, then add the `approved` label to publish.\n\n```json\n$json\n```\n";

$filed = false;
if (!empty($cfg['github_token']) && !empty($cfg['repo'])) {
    $ch = curl_init('https://api.github.com/repos/' . $cfg['repo'] . '/issues');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $cfg['github_token'],
            'Accept: application/vnd.github+json',
            'User-Agent: vedaheritage-story-intake',
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'title'  => 'Story: ' . $story['title'],
            'body'   => $issueBody,
            'labels' => ['story-submission'],
        ]),
    ]);
    curl_exec($ch);
    $filed = curl_getinfo($ch, CURLINFO_HTTP_CODE) === 201;
    curl_close($ch);
}
if (!$filed && !empty($cfg['notify_email'])) {
    $filed = @mail($cfg['notify_email'], 'Story submission: ' . $story['title'], $issueBody, 'Content-Type: text/plain; charset=utf-8');
}
if (!$filed) out(503, ['ok' => false, 'error' => 'We could not save your story right now.']);
out(200, ['ok' => true]);
