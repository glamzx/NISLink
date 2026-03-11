<?php
/**
 * NIS Alumni — File Upload Handler
 * 
 * POST /api/upload.php?type=avatar      — upload profile avatar
 * POST /api/upload.php?type=attachment   — upload post attachment
 * 
 * Expects multipart/form-data with a "file" field.
 * Returns the uploaded file's URL path.
 */

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
}

$userId = requireAuth();

$type = $_GET['type'] ?? 'attachment';

// Validate upload
if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    jsonResponse(['success' => false, 'message' => 'No file uploaded or upload error.'], 422);
}

$file = $_FILES['file'];
$maxSize = 10 * 1024 * 1024; // 10 MB

if ($file['size'] > $maxSize) {
    jsonResponse(['success' => false, 'message' => 'File too large (max 10 MB).'], 422);
}

// Allowed types
$allowedImage = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
$allowedAll   = array_merge($allowedImage, ['application/pdf', 'video/mp4', 'audio/webm', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/mpeg']);
$allowed = ($type === 'avatar' || $type === 'cover') ? $allowedImage : $allowedAll;

$mime = mime_content_type($file['tmp_name']);
if (!in_array($mime, $allowed)) {
    jsonResponse(['success' => false, 'message' => 'File type not allowed.'], 422);
}

// Determine upload directory
$baseDir = __DIR__ . '/../uploads';
$subDir  = ($type === 'avatar') ? 'avatars' : (($type === 'cover') ? 'covers' : 'attachments');
$uploadDir = "$baseDir/$subDir";

// Create dirs if needed
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

// Generate unique filename
$ext      = pathinfo($file['name'], PATHINFO_EXTENSION) ?: 'bin';
$filename = uniqid("{$userId}_", true) . '.' . $ext;
$destPath = "$uploadDir/$filename";

if (!move_uploaded_file($file['tmp_name'], $destPath)) {
    jsonResponse(['success' => false, 'message' => 'Failed to save file.'], 500);
}

// Relative URL path
$urlPath = "uploads/$subDir/$filename";

// If avatar, update user record
if ($type === 'avatar') {
    $db = getDB();
    $db->prepare('UPDATE users SET avatar_url = ? WHERE id = ?')
       ->execute([$urlPath, $userId]);
}

// If cover, update user record
if ($type === 'cover') {
    $db = getDB();
    $db->prepare('UPDATE users SET cover_url = ? WHERE id = ?')
       ->execute([$urlPath, $userId]);
}

jsonResponse([
    'success'       => true,
    'file_path'     => $urlPath,
    'original_name' => $file['name'],
    'file_type'     => (strpos($mime, 'image') !== false) ? 'image' : 'file',
    'message'       => 'File uploaded.',
]);
