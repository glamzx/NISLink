package com.nisconnect.service;

import com.nisconnect.dto.ChatMessageResponse;
import com.nisconnect.listener.WebSocketEventListener;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;

/**
 * NotificationService — handles smart, context-aware notification delivery.
 *
 * Architecture:
 *   1. All notification creation/broadcasting is @Async (fire-and-forget)
 *   2. Notifications are scoped: only sent to specific users, never broadcast to all
 *   3. Context-aware suppression: if a user is viewing a specific chat, message
 *      notifications for THAT chat are suppressed (the message already appears in the stream)
 *
 * WebSocket Topics:
 *   /user/{userId}/queue/notifications   — general notifications (likes, follows, comments)
 *   /user/{userId}/queue/messages        — private chat messages
 *   /user/{userId}/queue/typing          — typing indicators
 *   /user/{userId}/queue/read-receipt    — read receipt updates
 *   /user/{userId}/queue/message-edit    — message edit broadcasts
 *   /topic/post-updates                  — post edits (broadcast to feed viewers)
 */
@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final SimpMessagingTemplate messagingTemplate;
    private final WebSocketEventListener presenceTracker;

    public NotificationService(SimpMessagingTemplate messagingTemplate,
                               WebSocketEventListener presenceTracker) {
        this.messagingTemplate = messagingTemplate;
        this.presenceTracker = presenceTracker;
    }

    /**
     * Send a notification to a specific user asynchronously.
     * Context-aware: checks if the user is currently viewing the relevant section.
     *
     * @param targetUserId  The user to notify
     * @param type          Notification type (like, comment, follow, message, repost)
     * @param actorName     Display name of the person who triggered the notification
     * @param payload       Additional data (post_id, message preview, etc.)
     */
    @Async("chatDbExecutor")
    public void sendNotificationAsync(Long targetUserId, String type,
                                      String actorName, Map<String, Object> payload) {
        try {
            // Only send if user is online
            if (!presenceTracker.isOnline(targetUserId)) {
                log.debug("User {} is offline, skipping push notification for type={}", targetUserId, type);
                return;
            }

            // Context-aware suppression:
            // If user is in chat and the notification is for a message in their active chat,
            // suppress the pop-up (the realtime stream already handles it)
            String activeView = presenceTracker.getActiveView(targetUserId);
            if ("chat".equals(activeView) && "message".equals(type)) {
                log.debug("Suppressing message notification for user {} (already in chat view)", targetUserId);
                return;
            }

            Map<String, Object> notification = Map.of(
                    "type", type,
                    "actorName", actorName != null ? actorName : "Someone",
                    "timestamp", Instant.now().toString(),
                    "data", payload != null ? payload : Map.of()
            );

            messagingTemplate.convertAndSendToUser(
                    targetUserId.toString(),
                    "/queue/notifications",
                    notification
            );

            log.debug("Notification sent: type={}, target={}, actor={}", type, targetUserId, actorName);

        } catch (Exception e) {
            log.error("Failed to send notification to user {}: {}", targetUserId, e.getMessage());
        }
    }

    /**
     * Broadcast a read receipt to the message sender.
     * When a recipient opens a chat, this notifies senders that their messages were read.
     *
     * @param senderId       The original message sender (gets the receipt)
     * @param conversationId The conversation where messages were read
     * @param readAt         Timestamp when messages were marked as read
     */
    @Async("chatDbExecutor")
    public void broadcastReadReceipt(Long senderId, Long conversationId, Instant readAt) {
        try {
            if (!presenceTracker.isOnline(senderId)) return;

            Map<String, Object> receipt = Map.of(
                    "type", "read_receipt",
                    "conversationId", conversationId,
                    "readAt", readAt.toString()
            );

            messagingTemplate.convertAndSendToUser(
                    senderId.toString(),
                    "/queue/read-receipt",
                    receipt
            );

            log.debug("Read receipt sent to user {} for conversation {}", senderId, conversationId);

        } catch (Exception e) {
            log.error("Failed to send read receipt to user {}: {}", senderId, e.getMessage());
        }
    }

    /**
     * Broadcast a message edit to a specific user (the other person in the chat).
     * Only sends to the conversation partner, not to all connected clients.
     *
     * @param recipientId  The other user in the conversation
     * @param messageId    The edited message ID
     * @param newContent   The updated message text
     * @param editedAt     Timestamp of the edit
     */
    @Async("chatDbExecutor")
    public void broadcastMessageEdit(Long recipientId, Long messageId,
                                     String newContent, Instant editedAt) {
        try {
            if (!presenceTracker.isOnline(recipientId)) return;

            ChatMessageResponse editEvent = new ChatMessageResponse();
            editEvent.setId(messageId);
            editEvent.setContent(newContent);
            editEvent.setEditedAt(editedAt);
            editEvent.setType("edit");

            messagingTemplate.convertAndSendToUser(
                    recipientId.toString(),
                    "/queue/message-edit",
                    editEvent
            );

            log.debug("Message edit broadcast to user {} for message {}", recipientId, messageId);

        } catch (Exception e) {
            log.error("Failed to broadcast edit to user {}: {}", recipientId, e.getMessage());
        }
    }

    /**
     * Broadcast a post edit to all users currently viewing the feed.
     * Uses /topic/post-updates (a broadcast channel).
     *
     * @param postId     The edited post ID
     * @param newContent The updated post text
     */
    @Async("chatDbExecutor")
    public void broadcastPostEdit(Long postId, String newContent) {
        try {
            Map<String, Object> update = Map.of(
                    "type", "post_edit",
                    "postId", postId,
                    "content", newContent != null ? newContent : "",
                    "editedAt", Instant.now().toString()
            );

            messagingTemplate.convertAndSend("/topic/post-updates", update);
            log.debug("Post edit broadcast for post {}", postId);

        } catch (Exception e) {
            log.error("Failed to broadcast post edit for post {}: {}", postId, e.getMessage());
        }
    }
}
