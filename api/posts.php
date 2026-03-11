<?php
/**
 * NIS Alumni — Posts / Publications
 * 
 * GET  /api/posts.php              — all posts (feed)
 * GET  /api/posts.php?user_id=X    — posts by user X (wall)
 * POST /api/posts.php              — create new post (auth required)
 *   Body: { content }
 *   After creating, upload attachments via /api/upload.php
 * DELETE /api/posts.php?id=X       — delete own post (auth required)
 */

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');

$db = getDB();

// ── GET: Fetch posts ──────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $userId = $_GET['user_id'] ?? null;
    $page   = max(1, (int) ($_GET['page'] ?? 1));
    $limit  = 15;
    $offset = ($page - 1) * $limit;

    $where  = '';
    $params = [];

    if ($userId) {
        $where  = 'WHERE p.user_id = ?';
        $params = [(int) $userId];
    }

    // Count total
    $stmt = $db->prepare("SELECT COUNT(*) FROM posts p $where");
    $stmt->execute($params);
    $total = (int) $stmt->fetchColumn();

    // Fetch posts with author info + like/comment counts
    $currentUser = $_SESSION['user_id'] ?? 0;
    $sql = "
        SELECT 
            p.id, p.user_id, p.content, p.created_at, p.updated_at,
            u.full_name, u.avatar_url, u.nis_branch, u.graduation_year,
            (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) AS like_count,
            (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) AS comment_count,
            (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id AND user_id = $currentUser) AS is_liked
        FROM posts p
        JOIN users u ON u.id = p.user_id
        $where
        ORDER BY p.created_at DESC
        LIMIT $limit OFFSET $offset
    ";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $posts = $stmt->fetchAll();

    // Fetch attachments for each post
    $postIds = array_column($posts, 'id');
    $attachments = [];

    if (!empty($postIds)) {
        $placeholders = implode(',', array_fill(0, count($postIds), '?'));
        $stmt = $db->prepare("
            SELECT id, post_id, file_path, file_type, original_name
            FROM post_attachments
            WHERE post_id IN ($placeholders)
        ");
        $stmt->execute($postIds);

        foreach ($stmt->fetchAll() as $att) {
            $attachments[$att['post_id']][] = $att;
        }
    }

    // Merge attachments into posts
    foreach ($posts as &$post) {
        $post['attachments'] = $attachments[$post['id']] ?? [];
    }

    jsonResponse([
        'success' => true,
        'posts'   => $posts,
        'total'   => $total,
        'page'    => $page,
        'pages'   => (int) ceil($total / $limit),
    ]);
}

// ── POST: Create a new post ───────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $userId = requireAuth();
    $input  = json_decode(file_get_contents('php://input'), true) ?? $_POST;

    $content = trim($input['content'] ?? '');
    if (empty($content)) {
        jsonResponse(['success' => false, 'message' => 'Post content cannot be empty.'], 422);
    }

    $stmt = $db->prepare('INSERT INTO posts (user_id, content) VALUES (?, ?)');
    $stmt->execute([$userId, $content]);
    $postId = (int) $db->lastInsertId();

    // Handle attachments if any file paths were provided
    $attachments = $input['attachments'] ?? [];
    foreach ($attachments as $att) {
        if (!empty($att['file_path'])) {
            $stmt = $db->prepare('
                INSERT INTO post_attachments (post_id, file_path, file_type, original_name)
                VALUES (?, ?, ?, ?)
            ');
            $stmt->execute([
                $postId,
                $att['file_path'],
                $att['file_type'] ?? 'image',
                $att['original_name'] ?? null,
            ]);
        }
    }

    jsonResponse(['success' => true, 'post_id' => $postId, 'message' => 'Post created.'], 201);
}

// ── DELETE: Delete own post ───────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $userId = requireAuth();
    $postId = (int) ($_GET['id'] ?? 0);

    if ($postId === 0) {
        jsonResponse(['success' => false, 'message' => 'Post ID required.'], 422);
    }

    // Verify ownership
    $stmt = $db->prepare('SELECT user_id FROM posts WHERE id = ?');
    $stmt->execute([$postId]);
    $post = $stmt->fetch();

    if (!$post || (int) $post['user_id'] !== $userId) {
        jsonResponse(['success' => false, 'message' => 'Not authorized.'], 403);
    }

    $db->prepare('DELETE FROM posts WHERE id = ?')->execute([$postId]);

    jsonResponse(['success' => true, 'message' => 'Post deleted.']);
}

jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
