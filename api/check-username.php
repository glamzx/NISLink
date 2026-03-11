<?php
/**
 * NIS Alumni — Username Availability Check
 * 
 * GET /api/check-username.php?username=xyz
 * Returns { available: true/false }
 */

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');

$username = trim($_GET['username'] ?? '');

// Validate format: 3-30 chars, alphanumeric + underscores only
if (!preg_match('/^[a-zA-Z0-9_]{3,30}$/', $username)) {
    jsonResponse(['available' => false, 'message' => 'Username must be 3-30 characters (letters, numbers, underscores).']);
}

$db = getDB();
$stmt = $db->prepare('SELECT id FROM users WHERE username = ?');
$stmt->execute([strtolower($username)]);

jsonResponse(['available' => !$stmt->fetch()]);
