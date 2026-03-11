<?php
/**
 * NIS Alumni — Subscriptions (Follow / Unfollow)
 * 
 * GET    /api/subscriptions.php?user_id=X       — check follow/mutual status
 * GET    /api/subscriptions.php?list=followers   — list my followers
 * GET    /api/subscriptions.php?list=following   — list who I follow
 * POST   /api/subscriptions.php  { target_id }  — follow a user
 * DELETE /api/subscriptions.php  { target_id }  — unfollow a user
 */

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');

$db = getDB();

// ── GET ───────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $currentUser = $_SESSION['user_id'] ?? 0;

    // Check follow status for a specific user
    if (!empty($_GET['user_id'])) {
        $targetId = (int) $_GET['user_id'];

        $iFollow = false;
        $followsMe = false;

        if ($currentUser) {
            // Do I follow them?
            $stmt = $db->prepare('SELECT id FROM subscriptions WHERE follower_id = ? AND following_id = ?');
            $stmt->execute([$currentUser, $targetId]);
            $iFollow = (bool) $stmt->fetch();

            // Do they follow me?
            $stmt = $db->prepare('SELECT id FROM subscriptions WHERE follower_id = ? AND following_id = ?');
            $stmt->execute([$targetId, $currentUser]);
            $followsMe = (bool) $stmt->fetch();
        }

        // Follower/following counts
        $stmt = $db->prepare('SELECT COUNT(*) FROM subscriptions WHERE following_id = ?');
        $stmt->execute([$targetId]);
        $followerCount = (int) $stmt->fetchColumn();

        $stmt = $db->prepare('SELECT COUNT(*) FROM subscriptions WHERE follower_id = ?');
        $stmt->execute([$targetId]);
        $followingCount = (int) $stmt->fetchColumn();

        jsonResponse([
            'success'         => true,
            'i_follow'        => $iFollow,
            'follows_me'      => $followsMe,
            'is_mutual'       => $iFollow && $followsMe,
            'follower_count'  => $followerCount,
            'following_count' => $followingCount,
        ]);
    }

    // List followers or following (for any user)
    if (!empty($_GET['list'])) {
        $listType = $_GET['list'];
        $targetUser = (int) ($_GET['user_id'] ?? 0);
        if ($targetUser === 0) {
            $targetUser = requireAuth();
        }

        if ($listType === 'followers') {
            $stmt = $db->prepare('
                SELECT u.id, u.full_name, u.avatar_url, u.username, u.nis_branch, u.graduation_year
                FROM subscriptions s
                JOIN users u ON u.id = s.follower_id
                WHERE s.following_id = ?
                ORDER BY s.created_at DESC
            ');
        } else {
            $stmt = $db->prepare('
                SELECT u.id, u.full_name, u.avatar_url, u.username, u.nis_branch, u.graduation_year
                FROM subscriptions s
                JOIN users u ON u.id = s.following_id
                WHERE s.follower_id = ?
                ORDER BY s.created_at DESC
            ');
        }

        $stmt->execute([$targetUser]);
        jsonResponse(['success' => true, 'users' => $stmt->fetchAll()]);
    }

    jsonResponse(['success' => false, 'message' => 'Missing parameters.'], 422);
}

// ── POST: Follow ──────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $currentUser = requireAuth();
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $targetId = (int) ($input['target_id'] ?? 0);

    if ($targetId === 0 || $targetId === $currentUser) {
        jsonResponse(['success' => false, 'message' => 'Invalid target.'], 422);
    }

    // Check if already following
    $stmt = $db->prepare('SELECT id FROM subscriptions WHERE follower_id = ? AND following_id = ?');
    $stmt->execute([$currentUser, $targetId]);
    if ($stmt->fetch()) {
        jsonResponse(['success' => false, 'message' => 'Already following.'], 409);
    }

    $db->prepare('INSERT INTO subscriptions (follower_id, following_id) VALUES (?, ?)')
       ->execute([$currentUser, $targetId]);

    // Check if now mutual
    $stmt = $db->prepare('SELECT id FROM subscriptions WHERE follower_id = ? AND following_id = ?');
    $stmt->execute([$targetId, $currentUser]);
    $isMutual = (bool) $stmt->fetch();

    jsonResponse(['success' => true, 'is_mutual' => $isMutual, 'message' => 'Followed.'], 201);
}

// ── DELETE: Unfollow ──────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $currentUser = requireAuth();
    $input = json_decode(file_get_contents('php://input'), true);
    $targetId = (int) ($input['target_id'] ?? 0);

    if ($targetId === 0) {
        jsonResponse(['success' => false, 'message' => 'Invalid target.'], 422);
    }

    $db->prepare('DELETE FROM subscriptions WHERE follower_id = ? AND following_id = ?')
       ->execute([$currentUser, $targetId]);

    jsonResponse(['success' => true, 'message' => 'Unfollowed.']);
}

jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
