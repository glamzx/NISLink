<?php
/**
 * NIS Alumni — Profile Endpoint
 * 
 * GET  /api/profile.php?id=<userId>   — public profile data
 * POST /api/profile.php               — update own profile (auth required)
 */

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');

$db = getDB();

// ── GET: Fetch a user's profile ───────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $userId = (int) ($_GET['id'] ?? 0);

    // If no id provided, return the currently logged-in user's profile
    if ($userId === 0) {
        $userId = requireAuth();
    }

    $stmt = $db->prepare('
        SELECT id, full_name, email, nis_branch, graduation_year,
               university, degree_major, bio, status,
               linkedin, instagram, youtube, avatar_url, cover_url,
               created_at
        FROM users WHERE id = ?
    ');
    $stmt->execute([$userId]);
    $profile = $stmt->fetch();

    if (!$profile) {
        jsonResponse(['success' => false, 'message' => 'User not found.'], 404);
    }

    jsonResponse(['success' => true, 'profile' => $profile]);
}

// ── POST: Update own profile ──────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $userId = requireAuth();

    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

    // Whitelist of editable fields
    $allowed = [
        'full_name', 'nis_branch', 'graduation_year',
        'university', 'degree_major', 'bio', 'status',
        'linkedin', 'instagram', 'youtube', 'avatar_url',
    ];

    $sets   = [];
    $values = [];

    foreach ($allowed as $field) {
        if (array_key_exists($field, $input)) {
            $sets[]   = "`$field` = ?";
            $values[] = $input[$field];
        }
    }

    if (empty($sets)) {
        jsonResponse(['success' => false, 'message' => 'No fields to update.'], 422);
    }

    $values[] = $userId;
    $sql = 'UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?';
    $db->prepare($sql)->execute($values);

    jsonResponse(['success' => true, 'message' => 'Profile updated successfully.']);
}

jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
