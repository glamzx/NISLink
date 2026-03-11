<?php
/**
 * NIS Alumni — Post Comments
 * 
 * GET    /api/comments.php?post_id=X          — list comments for a post
 * POST   /api/comments.php { post_id, content } — add a comment (auth required)
 * DELETE /api/comments.php?id=X               — delete own comment (auth required)
 */

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');

$db = getDB();

// ── GET: List comments ───────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $postId = (int) ($_GET['post_id'] ?? 0);
    if ($postId === 0) {
        jsonResponse(['success' => false, 'message' => 'post_id required.'], 422);
    }

    $stmt = $db->prepare('
        SELECT c.id, c.post_id, c.user_id, c.content, c.created_at,
               u.full_name, u.avatar_url
        FROM post_comments c
        JOIN users u ON u.id = c.user_id
        WHERE c.post_id = ?
        ORDER BY c.created_at ASC
    ');
    $stmt->execute([$postId]);
    $comments = $stmt->fetchAll();

    // Comment count
    $count = count($comments);

    jsonResponse([
        'success'       => true,
        'comments'      => $comments,
        'comment_count' => $count,
    ]);
}

// ── POST: Add comment ────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $userId = requireAuth();
    $input  = json_decode(file_get_contents('php://input'), true) ?? $_POST;

    $postId  = (int) ($input['post_id'] ?? 0);
    $content = trim($input['content'] ?? '');

    if ($postId === 0) {
        jsonResponse(['success' => false, 'message' => 'post_id required.'], 422);
    }
    if (empty($content)) {
        jsonResponse(['success' => false, 'message' => 'Comment cannot be empty.'], 422);
    }

    $db->prepare('INSERT INTO post_comments (post_id, user_id, content) VALUES (?, ?, ?)')
       ->execute([$postId, $userId, $content]);

    $commentId = (int) $db->lastInsertId();

    // Return the new comment with user info
    $stmt = $db->prepare('
        SELECT c.id, c.post_id, c.user_id, c.content, c.created_at,
               u.full_name, u.avatar_url
        FROM post_comments c
        JOIN users u ON u.id = c.user_id
        WHERE c.id = ?
    ');
    $stmt->execute([$commentId]);
    $comment = $stmt->fetch();

    jsonResponse(['success' => true, 'comment' => $comment, 'message' => 'Comment added.'], 201);
}

// ── DELETE: Delete own comment ───────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $userId    = requireAuth();
    $commentId = (int) ($_GET['id'] ?? 0);

    if ($commentId === 0) {
        jsonResponse(['success' => false, 'message' => 'Comment ID required.'], 422);
    }

    // Verify ownership
    $stmt = $db->prepare('SELECT user_id FROM post_comments WHERE id = ?');
    $stmt->execute([$commentId]);
    $comment = $stmt->fetch();

    if (!$comment || (int) $comment['user_id'] !== $userId) {
        jsonResponse(['success' => false, 'message' => 'Not authorized.'], 403);
    }

    $db->prepare('DELETE FROM post_comments WHERE id = ?')->execute([$commentId]);

    jsonResponse(['success' => true, 'message' => 'Comment deleted.']);
}

jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
