<?php
// Receives traveller stories (and up to 2 photos) from /stories and /discover/*
// and files them for the twice-weekly review.
//   - Story  -> GitHub issue labelled "story-submission"
//   - Photos -> re-encoded (EXIF/GPS stripped) and stored on the quarantine branch
//               "community-uploads" at pending-uploads/<id>/<n>.jpg (never public)
//
// Setup (once, on Hostinger): create /domains/vedaheritage.co.in/vh-config.php
// OUTSIDE public_html with:
//   <?php return ['github_token' => 'github_pat_xxx', 'repo' => 'eccellere-consult/vedaheritage',
//                 'notify_email' => 'stay@vedaheritage.co.in'];
// Token permissions on this one repo only: Issues = write, Contents = write.
// Create the branch once:  git push origin main:community-uploads

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function out(int $code, array $body): void { http_response_code($code); echo json_encode($body); exit; }
function clean(?string $v, int $max): string {
    $v = trim(strip_tags((string)$v));
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $v);
    return mb_substr($v, 0, $max);
}
function gh(array $cfg, string $method, string $path, array $payload): array {
    $ch = curl_init('https://api.github.com/repos/' . $cfg['repo'] . $path);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $cfg['github_token'],
            'Accept: application/vnd.github+json',
            'User-Agent: vedaheritage-story-intake',
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode($payload),
    ]);
    curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$code >= 200 && $code < 300, $code];
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(405, ['ok' => false, 'error' => 'POST only.']);
if (!empty($_POST['website'])) out(200, ['ok' => true]); // honeypot

// Per-IP rate limit: 5 submissions per hour.
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rl = sys_get_temp_dir() . '/vh_story_' . hash('sha256', $ip);
$hits = is_file($rl) ? array_values(array_filter(array_map('intval', file($rl, FILE_IGNORE_NEW_LINES)), fn($t) => $t > time() - 3600)) : [];
if (count($hits) >= 5) out(429, ['ok' => false, 'error' => 'Too many submissions. Please try again later.']);

$types = ['Experience', 'Folklore I heard', 'Travel tip', 'Family recipe', 'Muthassi story'];
$cats  = ['temples', 'places', 'beaches', 'backwaters', 'heritage', 'ayurveda', 'vedic', 'healing', 'plants', 'cultivation', 'music', 'dance', 'astrology', 'weddings', 'medical', 'food', 'muthassi', 'crafts', 'artisans', 'wear'];
$id    = gmdate('Ymd') . '-' . bin2hex(random_bytes(4));

$story = [
    'submissionId' => $id,
    'type'   => in_array($_POST['type'] ?? '', $types, true) ? $_POST['type'] : 'Experience',
    'title'  => clean($_POST['title'] ?? '', 120),
    'body'   => clean($_POST['body'] ?? '', 4000),
    'author' => clean($_POST['author'] ?? '', 60),
    'origin' => clean($_POST['origin'] ?? '', 60),
];
$cat = $_POST['entryCategory'] ?? ''; $slug = $_POST['entrySlug'] ?? '';
if (in_array($cat, $cats, true) && preg_match('/^[a-z0-9-]{1,80}$/', $slug)) { $story['entryCategory'] = $cat; $story['entrySlug'] = $slug; }
if (empty($_POST['consent']) || $story['title'] === '' || $story['author'] === '' || mb_strlen($story['body']) < 40) {
    out(422, ['ok' => false, 'error' => 'Please complete all required fields.']);
}
if (preg_match('~https?://|www\.~i', $story['body'] . $story['title'])) out(422, ['ok' => false, 'error' => 'Please leave out web links.']);

$cfgFile = dirname(__DIR__, 2) . '/vh-config.php';
$cfg = is_file($cfgFile) ? require $cfgFile : [];
$haveGh = !empty($cfg['github_token']) && !empty($cfg['repo']);

// ---- Photos --------------------------------------------------------------
$photos = [];
$files = $_FILES['photos'] ?? null;
if ($files && is_array($files['name'])) {
    $n = 0;
    foreach ($files['name'] as $i => $_) {
        if ($files['error'][$i] === UPLOAD_ERR_NO_FILE) continue;
        if (++$n > 2) break;
        if (empty($_POST['photoConsent'])) out(422, ['ok' => false, 'error' => 'Please confirm you took the photos.']);
        if ($files['error'][$i] !== UPLOAD_ERR_OK || $files['size'][$i] > 5 * 1024 * 1024) out(422, ['ok' => false, 'error' => 'Each photo must be under 5 MB.']);
        if (!function_exists('imagecreatefromstring') || !$haveGh) out(503, ['ok' => false, 'error' => 'Photo uploads are not available right now.']);
        $info = @getimagesize($files['tmp_name'][$i]);
        if (!$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) out(422, ['ok' => false, 'error' => 'Photos must be JPG, PNG or WebP.']);
        $img = @imagecreatefromstring(file_get_contents($files['tmp_name'][$i]));
        if (!$img) out(422, ['ok' => false, 'error' => 'Could not read one of the photos.']);
        $w = imagesx($img); $h = imagesy($img);
        if ($w > 1600) { $img = imagescale($img, 1600); }   // re-encode strips EXIF / GPS
        ob_start(); imagejpeg($img, null, 82); $jpg = ob_get_clean(); imagedestroy($img);
        $path = "pending-uploads/$id/$n.jpg";
        [$ok] = gh($cfg, 'PUT', "/contents/$path", ['message' => "pending upload $id/$n", 'content' => base64_encode($jpg), 'branch' => 'community-uploads']);
        if (!$ok) out(503, ['ok' => false, 'error' => 'We could not save your photo right now.']);
        $photos[] = ['path' => $path, 'alt' => clean($_POST['photoCaption'] ?? '', 160) ?: ('Photo by ' . $story['author']), 'credit' => $story['author']];
    }
}
if ($photos) $story['photos'] = $photos;

$hits[] = time();
file_put_contents($rl, implode("\n", $hits));

// ---- File the story -------------------------------------------------------
$json = json_encode($story, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
$issueBody = "Submitted via website. Review, then add the `approved` label to publish."
    . ($photos ? " Photos are on branch `community-uploads` under `pending-uploads/$id/`." : '')
    . "\n\n```json\n$json\n```\n";

$filed = false;
if ($haveGh) [$filed] = gh($cfg, 'POST', '/issues', ['title' => 'Story: ' . $story['title'], 'body' => $issueBody, 'labels' => ['story-submission']]);
if (!$filed && !empty($cfg['notify_email'])) $filed = @mail($cfg['notify_email'], 'Story submission: ' . $story['title'], $issueBody, 'Content-Type: text/plain; charset=utf-8');
if (!$filed) out(503, ['ok' => false, 'error' => 'We could not save your story right now.']);
out(200, ['ok' => true]);
