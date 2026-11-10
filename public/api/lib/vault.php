<?php
// Document vault: identity documents and sensitive identity data are encrypted at rest (libsodium secretbox) with a key that lives
// only in vh-config.php ('doc_key', base64 of 32 random bytes). Files live in the private data folder, never in GitHub or the web root.
// Every read by anyone other than the owner is written to an audit log. Documents are deleted on a schedule (retention).
if (!defined('VH_LIB')) define('VH_LIB', 1);
require_once __DIR__ . '/common.php';

const VAULT_MAX_BYTES = 5 * 1024 * 1024;
const CONSENT_VERSION = '2026-11';

function vault_dir(string $sub = ''): string {
    $d = vh_data_dir() . '/kyc' . ($sub !== '' ? "/$sub" : '');
    if (!is_dir($d)) @mkdir($d, 0700, true);
    return $d;
}
/** The encryption key, or null when none is configured. In test mode a throwaway key is derived so the flows can be tried (those documents are flagged test). */
function vault_key(): ?string {
    if (!function_exists('sodium_crypto_secretbox')) return null;
    $k = base64_decode((string)(vh_cfg()['doc_key'] ?? ''), true);
    if ($k !== false && strlen($k) === SODIUM_CRYPTO_SECRETBOX_KEYBYTES) return $k;
    if (function_exists('bk_test') && bk_test()) return sodium_crypto_generichash('vh-test-vault|' . (string)(vh_cfg()['admin_password_hash'] ?? 'x'), '', SODIUM_CRYPTO_SECRETBOX_KEYBYTES);
    return null;
}
function vault_real_key(): bool { $k = base64_decode((string)(vh_cfg()['doc_key'] ?? ''), true); return function_exists('sodium_crypto_secretbox') && $k !== false && strlen($k) === 32; }
function vault_ready(): bool { return vault_key() !== null; }

function vault_seal(string $plain): ?string {
    $k = vault_key(); if ($k === null) return null;
    $n = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
    return $n . sodium_crypto_secretbox($plain, $n, $k);
}
function vault_open(string $blob): ?string {
    $k = vault_key(); if ($k === null || strlen($blob) < SODIUM_CRYPTO_SECRETBOX_NONCEBYTES + SODIUM_CRYPTO_SECRETBOX_MACBYTES) return null;
    $p = sodium_crypto_secretbox_open(substr($blob, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES), substr($blob, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES), $k);
    return $p === false ? null : $p;
}
/** Sealed JSON for small records (identity details). */
function vault_seal_json(array $d): ?string { $s = vault_seal(json_encode($d, JSON_UNESCAPED_UNICODE)); return $s === null ? null : base64_encode($s); }
function vault_open_json(string $b64): ?array { $o = vault_open((string)base64_decode($b64, true)); $j = $o === null ? null : json_decode($o, true); return is_array($j) ? $j : null; }

/** File type from the first bytes (never from the name the uploader gave). */
function vault_kind(string $b): ?array {
    if (strncmp($b, "\xFF\xD8\xFF", 3) === 0) return ['jpg', 'image/jpeg'];
    if (strncmp($b, "\x89PNG\r\n\x1a\n", 8) === 0) return ['png', 'image/png'];
    if (strncmp($b, '%PDF-', 5) === 0) return ['pdf', 'application/pdf'];
    return null;
}
/** Stores an encrypted document. $owner = ['type' => 'account'|'provider', 'id' => ...]. Returns the metadata array or an error string. */
function vault_put(string $bytes, array $owner, string $docType, ?string $deleteAfter = null) {
    if (!vault_ready()) return 'Document storage is not set up yet.';
    if ($bytes === '' || strlen($bytes) > VAULT_MAX_BYTES) return 'The file must be under 5 MB.';
    $k = vault_kind($bytes); if (!$k) return 'Upload a JPEG, PNG or PDF file.';
    $id = new_id(); $blob = vault_seal($bytes); if ($blob === null) return 'Could not store the file.';
    if (@file_put_contents(vault_dir('files') . "/$id.bin", $blob, LOCK_EX) === false) return 'Could not store the file.';
    $m = ['id' => $id, 'owner' => $owner, 'docType' => $docType, 'kind' => $k[0], 'mime' => $k[1], 'size' => strlen($bytes), 'created' => gmdate('c'), 'deleteAfter' => $deleteAfter, 'test' => !vault_real_key()];
    save_json(vault_dir('meta') . "/$id.json", $m); return $m;
}
function vault_meta(string $id): ?array { return valid_id($id) ? json_file(vault_dir('meta') . "/$id.json") : null; }
/** Decrypted bytes plus metadata, or null. Callers must have checked access and written the audit line. */
function vault_get(string $id): ?array {
    $m = vault_meta($id); if (!$m) return null;
    $blob = @file_get_contents(vault_dir('files') . "/$id.bin"); if ($blob === false) return null;
    $b = vault_open($blob); return $b === null ? null : ['bytes' => $b, 'meta' => $m];
}
function vault_delete(string $id): void { if (!valid_id($id)) return; @unlink(vault_dir('files') . "/$id.bin"); @unlink(vault_dir('meta') . "/$id.json"); }
function vault_delete_owned(string $type, string $ownerId): int { $n = 0; foreach (glob(vault_dir('meta') . '/*.json') ?: [] as $f) { $m = json_file($f); if ($m && ($m['owner']['type'] ?? '') === $type && ($m['owner']['id'] ?? '') === $ownerId) { vault_delete($m['id']); $n++; } } return $n; }
function vault_owned(string $type, string $ownerId): array { $o = []; foreach (glob(vault_dir('meta') . '/*.json') ?: [] as $f) { $m = json_file($f); if ($m && ($m['owner']['type'] ?? '') === $type && ($m['owner']['id'] ?? '') === $ownerId) $o[] = $m; } usort($o, fn($a, $b) => strcmp($a['created'], $b['created'])); return $o; }
/** Deletes documents past their delete-after date. Called lazily. Returns how many were removed. */
function vault_purge(): int { $n = 0; $today = gmdate('Y-m-d'); foreach (glob(vault_dir('meta') . '/*.json') ?: [] as $f) { $m = json_file($f); if ($m && !empty($m['deleteAfter']) && $m['deleteAfter'] < $today) { vault_delete($m['id']); $n++; } } return $n; }
/** Audit trail: who looked at what, when and why. IP addresses are stored hashed. */
function vault_audit(string $who, string $action, string $ref, string $reason = ''): void {
    $line = json_encode(['at' => gmdate('c'), 'who' => $who, 'action' => $action, 'ref' => $ref, 'reason' => mb_substr($reason, 0, 200), 'ip' => substr(hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|vh'), 0, 12)]);
    @file_put_contents(vault_dir() . '/audit.log', $line . "\n", FILE_APPEND | LOCK_EX);
}
function vault_audit_tail(int $n = 80): array { $f = vault_dir() . '/audit.log'; $l = is_file($f) ? array_slice(file($f, FILE_IGNORE_NEW_LINES), -$n) : []; return array_reverse(array_map(fn($x) => json_decode($x, true) ?: [], $l)); }
/** Removes every document and sensitive record created with the throwaway test key. */
function vault_purge_test(): int { $n = 0; foreach (glob(vault_dir('meta') . '/*.json') ?: [] as $f) { $m = json_file($f); if ($m && !empty($m['test'])) { vault_delete($m['id']); $n++; } } return $n; }
