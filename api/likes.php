<?php
/**
 * NIS Alumni — Post Likes
 * 
 * GET  /api/likes.php?post_id=X   — get like count + whether current user liked it
 * POST /api/likes.php { post_id } — toggle like (like/unlike)
 */

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');

$db = getDB();

// ── GET: Like info ───────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $postId = (int)($_GET['post_id'] ?? 0);
    if ($postId === 0) {
        jsonResponse(['success' => false, 'message' => 'post_id required.'], 422);
    }

    $currentUser = $_SESSION['user_id'] ?? 0;

    // Like count
    $stmt = $db->prepare('SELECT COUNT(*) FROM post_likes WHERE post_id = ?');
    $stmt->execute([$postId]);
    $count = (int)$stmt->fetchColumn();

    // Did current user like it?
    $isLiked = false;
    if ($currentUser) {
        $stmt = $db->prepare('SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?');
        $stmt->execute([$postId, $currentUser]);
        $isLiked = (bool)$stmt->fetch();
    }

    jsonResponse([
        'success' => true,
        'like_count' => $count,
        'is_liked' => $isLiked,
    ]);
}

// ── POST: Toggle like ────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $userId = requireAuth();
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $postId = (int)($input['post_id'] ?? 0);

    if ($postId === 0) {
        jsonResponse(['success' => false, 'message' => 'post_id required.'], 422);
    }

    // Check if already liked
    $stmt = $db->prepare('SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?');
    $stmt->execute([$postId, $userId]);
    $existing = $stmt->fetch();

    if ($existing) {
        // Unlike
        $db->prepare('DELETE FROM post_likes WHERE id = ?')->execute([$existing['id']]);
        $action = 'unliked';
    }
    else {
        // Like
        $db->prepare('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)')->execute([$postId, $userId]);
        $action = 'liked';
    }

    // Return updated count
    $stmt = $db->prepare('SELECT COUNT(*) FROM post_likes WHERE post_id = ?');
    $stmt->execute([$postId]);
    $count = (int)$stmt->fetchColumn();

    jsonResponse([
        'success' => true,
        'action' => $action,
        'is_liked' => $action === 'liked',
        'like_count' => $count,
    ]);
}

jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);