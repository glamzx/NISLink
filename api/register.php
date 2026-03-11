<?php
/**
 * NIS Alumni — Registration Endpoint
 * 
 * POST /api/register.php
 * Body: { email, password, confirm_password, full_name, nis_branch, graduation_year }
 */

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');

// Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
}

// Parse input
$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

$email           = trim($input['email'] ?? '');
$password        = $input['password'] ?? '';
$confirmPassword = $input['confirm_password'] ?? '';
$fullName        = trim($input['full_name'] ?? '');
$username        = strtolower(trim($input['username'] ?? ''));
$nisBranch       = trim($input['nis_branch'] ?? '');
$gradYear        = $input['graduation_year'] ?? null;

// ── Validation ────────────────────────────────────────────
$errors = [];

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'A valid email is required.';
}
if (strlen($password) < 6) {
    $errors[] = 'Password must be at least 6 characters.';
}
if ($password !== $confirmPassword) {
    $errors[] = 'Passwords do not match.';
}
if (empty($fullName)) {
    $errors[] = 'Full name is required.';
}
if (!preg_match('/^[a-zA-Z0-9_]{3,30}$/', $username)) {
    $errors[] = 'Username must be 3-30 characters (letters, numbers, underscores).';
}

if (!empty($errors)) {
    jsonResponse(['success' => false, 'errors' => $errors], 422);
}

// ── Check for duplicate email / username ──────────────────
$db  = getDB();
$stmt = $db->prepare('SELECT id FROM users WHERE email = ?');
$stmt->execute([$email]);
if ($stmt->fetch()) {
    jsonResponse(['success' => false, 'message' => 'An account with this email already exists.'], 409);
}

$stmt = $db->prepare('SELECT id FROM users WHERE username = ?');
$stmt->execute([$username]);
if ($stmt->fetch()) {
    jsonResponse(['success' => false, 'message' => 'This username is already taken.'], 409);
}

// ── Insert new user ───────────────────────────────────────
$hash = password_hash($password, PASSWORD_DEFAULT);

$stmt = $db->prepare('
    INSERT INTO users (username, email, password_hash, full_name, nis_branch, graduation_year)
    VALUES (?, ?, ?, ?, ?, ?)
');
$stmt->execute([$username, $email, $hash, $fullName, $nisBranch ?: null, $gradYear ?: null]);

$userId = (int) $db->lastInsertId();

// Auto-login after registration
$_SESSION['user_id'] = $userId;

jsonResponse(['success' => true, 'user_id' => $userId, 'message' => 'Registration successful.'], 201);
