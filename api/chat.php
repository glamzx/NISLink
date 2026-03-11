<?php
/**
 * NIS Alumni — Chat API
 * 
 * GET    /api/chat.php                    — list all conversations
 * GET    /api/chat.php?with=USER_ID       — get messages with a specific user
 * POST   /api/chat.php { recipient_id, content?, attachment_path?, attachment_type? }
 */

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');

$db = getDB();

// ── GET ───────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $currentUser = requireAuth();

    // Get messages with a specific user
    if (!empty($_GET['with'])) {
        $otherId = (int) $_GET['with'];

        // Find or identify conversation
        $convId = getConversationId($db, $currentUser, $otherId);

        if (!$convId) {
            // No conversation yet, return empty
            // Get other user info
            $stmt = $db->prepare('SELECT id, full_name, avatar_url, username FROM users WHERE id = ?');
            $stmt->execute([$otherId]);
            $otherUser = $stmt->fetch();

            jsonResponse([
                'success'  => true,
                'messages' => [],
                'other_user' => $otherUser,
            ]);
        }

        // Get messages
        $stmt = $db->prepare('
            SELECT m.id, m.sender_id, m.content, m.attachment_path, m.attachment_type, m.created_at,
                   u.full_name, u.avatar_url
            FROM messages m
            JOIN users u ON u.id = m.sender_id
            WHERE m.conversation_id = ?
            ORDER BY m.created_at ASC
            LIMIT 200
        ');
        $stmt->execute([$convId]);
        $messages = $stmt->fetchAll();

        // Get other user info
        $stmt = $db->prepare('SELECT id, full_name, avatar_url, username FROM users WHERE id = ?');
        $stmt->execute([$otherId]);
        $otherUser = $stmt->fetch();

        jsonResponse([
            'success'    => true,
            'messages'   => $messages,
            'other_user' => $otherUser,
        ]);
    }

    // List all conversations
    $stmt = $db->prepare('
        SELECT c.id AS conv_id, c.updated_at,
               CASE WHEN c.user_a = ? THEN c.user_b ELSE c.user_a END AS other_user_id
        FROM conversations c
        WHERE c.user_a = ? OR c.user_b = ?
        ORDER BY c.updated_at DESC
    ');
    $stmt->execute([$currentUser, $currentUser, $currentUser]);
    $convs = $stmt->fetchAll();

    // Enrich with user info and last message
    $conversations = [];
    foreach ($convs as $conv) {
        $stmt = $db->prepare('SELECT id, full_name, avatar_url, username FROM users WHERE id = ?');
        $stmt->execute([$conv['other_user_id']]);
        $otherUser = $stmt->fetch();

        $stmt = $db->prepare('
            SELECT content, attachment_type, created_at FROM messages
            WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1
        ');
        $stmt->execute([$conv['conv_id']]);
        $lastMsg = $stmt->fetch();

        $conversations[] = [
            'conv_id'      => $conv['conv_id'],
            'other_user'   => $otherUser,
            'last_message' => $lastMsg,
            'updated_at'   => $conv['updated_at'],
        ];
    }

    jsonResponse(['success' => true, 'conversations' => $conversations]);
}

// ── POST: Send a message ─────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $currentUser = requireAuth();
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

    $recipientId    = (int) ($input['recipient_id'] ?? 0);
    $content        = trim($input['content'] ?? '');
    $attachmentPath = $input['attachment_path'] ?? null;
    $attachmentType = $input['attachment_type'] ?? null;

    if ($recipientId === 0 || $recipientId === $currentUser) {
        jsonResponse(['success' => false, 'message' => 'Invalid recipient.'], 422);
    }
    if (empty($content) && empty($attachmentPath)) {
        jsonResponse(['success' => false, 'message' => 'Message or attachment required.'], 422);
    }

    // Find or create conversation
    $convId = getConversationId($db, $currentUser, $recipientId);

    if (!$convId) {
        // Create conversation (always store lower ID as user_a)
        $a = min($currentUser, $recipientId);
        $b = max($currentUser, $recipientId);
        $db->prepare('INSERT INTO conversations (user_a, user_b) VALUES (?, ?)')->execute([$a, $b]);
        $convId = (int) $db->lastInsertId();
    }

    // Insert message
    $db->prepare('
        INSERT INTO messages (conversation_id, sender_id, content, attachment_path, attachment_type)
        VALUES (?, ?, ?, ?, ?)
    ')->execute([$convId, $currentUser, $content ?: null, $attachmentPath, $attachmentType]);

    $messageId = (int) $db->lastInsertId();

    // Touch conversation updated_at
    $db->prepare('UPDATE conversations SET updated_at = NOW() WHERE id = ?')->execute([$convId]);

    // Return the new message
    $stmt = $db->prepare('
        SELECT m.id, m.sender_id, m.content, m.attachment_path, m.attachment_type, m.created_at,
               u.full_name, u.avatar_url
        FROM messages m
        JOIN users u ON u.id = m.sender_id
        WHERE m.id = ?
    ');
    $stmt->execute([$messageId]);
    $message = $stmt->fetch();

    jsonResponse(['success' => true, 'message' => $message], 201);
}

jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);

// ── Helper ───────────────────────────────────────────────
function getConversationId(PDO $db, int $userA, int $userB): ?int {
    $a = min($userA, $userB);
    $b = max($userA, $userB);
    $stmt = $db->prepare('SELECT id FROM conversations WHERE user_a = ? AND user_b = ?');
    $stmt->execute([$a, $b]);
    $row = $stmt->fetch();
    return $row ? (int) $row['id'] : null;
}
