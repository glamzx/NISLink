package com.nisconnect.controller;

import com.nisconnect.dto.ChatMessageRequest;
import com.nisconnect.dto.ChatMessageResponse;
import com.nisconnect.model.UserEntity;
import com.nisconnect.service.ChatService;
import com.nisconnect.service.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.time.Instant;
import java.util.Map;

/**
 * WebSocket chat controller — handles real-time messaging via STOMP.
 *
 * Endpoints (STOMP destinations):
 *   /app/chat.send      — send a message to another user
 *   /app/chat.typing     — broadcast typing indicator
 *   /app/chat.read       — mark messages as read (triggers read receipt to sender)
 *   /app/chat.edit       — edit a message (broadcasts to recipient in real-time)
 *   /app/chat.view       — report the user's active view (for smart notifications)
 *
 * Client subscribes to:
 *   /user/{userId}/queue/messages      — receive private messages
 *   /user/{userId}/queue/typing        — receive typing indicators
 *   /user/{userId}/queue/read-receipt  — receive read receipt updates
 *   /user/{userId}/queue/message-edit  — receive message edit notifications
 *   /user/{userId}/queue/notifications — receive general notifications
 *   /topic/post-updates               — receive live post edit updates
 */
@Controller
public class ChatController {

    private static final Logger log = LoggerFactory.getLogger(ChatController.class);
    private static final int MAX_CONTENT_LENGTH = 5000;

    private final SimpMessagingTemplate messagingTemplate;
    private final ChatService chatService;
    private final NotificationService notificationService;

    public ChatController(SimpMessagingTemplate messagingTemplate,
                          ChatService chatService,
                          NotificationService notificationService) {
        this.messagingTemplate = messagingTemplate;
        this.chatService = chatService;
        this.notificationService = notificationService;
    }

    /**
     * Handle incoming chat messages.
     *
     * Flow:
     *   1. Extract sender from WebSocket session (set by HttpHandshakeInterceptor)
     *   2. Validate input (content length, recipient)
     *   3. Build the outbound DTO with sender metadata
     *   4. Push immediately to the recipient via STOMP → zero-latency delivery
     *   5. Fire async DB save → MySQL write happens in background
     *   6. Send context-aware notification
     */
    @MessageMapping("/chat.send")
    public void sendMessage(@Payload ChatMessageRequest request,
                            SimpMessageHeaderAccessor headerAccessor) {

        // ── Extract authenticated user from WS session ───────
        Long senderId = getUserIdFromSession(headerAccessor);
        if (senderId == null) {
            log.warn("Message rejected — no authenticated user in session");
            return;
        }

        // ── Validate ─────────────────────────────────────────
        if (request.getRecipientId() == null || request.getRecipientId().equals(senderId)) {
            log.warn("Invalid recipient: {}", request.getRecipientId());
            return;
        }
        if (isBlank(request.getContent()) && isBlank(request.getAttachmentPath())) {
            log.warn("Empty message from user {}", senderId);
            return;
        }

        // ── Content length validation ────────────────────────
        if (request.getContent() != null && request.getContent().length() > MAX_CONTENT_LENGTH) {
            log.warn("Message too long from user {} ({} chars)", senderId, request.getContent().length());
            ChatMessageResponse error = new ChatMessageResponse();
            error.setContent("[System] Message too long (max " + MAX_CONTENT_LENGTH + " characters).");
            error.setSenderId(0L);
            error.setSenderName("System");
            error.setType("error");
            messagingTemplate.convertAndSendToUser(senderId.toString(), "/queue/messages", error);
            return;
        }

        // ── Build outbound message ───────────────────────────
        UserEntity sender = chatService.getUserById(senderId);
        ChatMessageResponse response = ChatMessageResponse.of(
                senderId,
                sender != null ? sender.getFullName() : "Unknown",
                sender != null ? sender.getAvatarUrl() : null,
                request.getContent(),
                request.getAttachmentPath(),
                request.getAttachmentType()
        );

        // ── 1. Push to recipient INSTANTLY via WebSocket ─────
        messagingTemplate.convertAndSendToUser(
                request.getRecipientId().toString(),
                "/queue/messages",
                response
        );

        // Also echo back to sender (so their UI confirms delivery)
        messagingTemplate.convertAndSendToUser(
                senderId.toString(),
                "/queue/messages",
                response
        );

        log.debug("Message pushed: {} → {}", senderId, request.getRecipientId());

        // ── 2. Persist to DB in background (fire-and-forget) ─
        chatService.saveMessageAsync(
                senderId,
                request.getRecipientId(),
                request.getContent(),
                request.getAttachmentPath(),
                request.getAttachmentType()
        );

        // ── 3. Send smart notification ───────────────────────
        String senderName = sender != null ? sender.getFullName() : "Someone";
        notificationService.sendNotificationAsync(
                request.getRecipientId(),
                "message",
                senderName,
                Map.of("preview", truncate(request.getContent(), 100))
        );
    }

    /**
     * Handle typing indicators.
     * Lightweight — no DB write, just a push to the other user.
     */
    @MessageMapping("/chat.typing")
    public void typingIndicator(@Payload ChatMessageRequest request,
                                SimpMessageHeaderAccessor headerAccessor) {

        Long senderId = getUserIdFromSession(headerAccessor);
        if (senderId == null || request.getRecipientId() == null) return;

        UserEntity sender = chatService.getUserById(senderId);

        ChatMessageResponse typing = new ChatMessageResponse();
        typing.setSenderId(senderId);
        typing.setSenderName(sender != null ? sender.getFullName() : "Someone");
        typing.setContent("__TYPING__");
        typing.setType("typing");

        messagingTemplate.convertAndSendToUser(
                request.getRecipientId().toString(),
                "/queue/typing",
                typing
        );
    }

    /**
     * Handle "messages read" event.
     * When a user opens a chat, they send this to mark messages as read.
     * The sender then gets a real-time read receipt (✓ → ✓✓).
     */
    @MessageMapping("/chat.read")
    public void markAsRead(@Payload Map<String, Object> payload,
                           SimpMessageHeaderAccessor headerAccessor) {

        Long userId = getUserIdFromSession(headerAccessor);
        if (userId == null) return;

        Object convIdObj = payload.get("conversationId");
        Object senderIdObj = payload.get("senderId");
        if (convIdObj == null) return;

        Long conversationId = Long.valueOf(convIdObj.toString());
        Instant readAt = Instant.now();

        // Mark in DB asynchronously
        chatService.markMessagesReadAsync(conversationId, userId, readAt);

        // Broadcast read receipt to the sender
        if (senderIdObj != null) {
            Long senderId = Long.valueOf(senderIdObj.toString());
            notificationService.broadcastReadReceipt(senderId, conversationId, readAt);
        }

        log.debug("Read receipt processed: user={}, conversation={}", userId, conversationId);
    }

    /**
     * Handle message edit event.
     * Validates that the sender is editing their own message,
     * then broadcasts the edit to the other participant.
     */
    @MessageMapping("/chat.edit")
    public void editMessage(@Payload Map<String, Object> payload,
                            SimpMessageHeaderAccessor headerAccessor) {

        Long senderId = getUserIdFromSession(headerAccessor);
        if (senderId == null) return;

        Object msgIdObj = payload.get("messageId");
        Object newContentObj = payload.get("content");
        Object recipientIdObj = payload.get("recipientId");
        if (msgIdObj == null || newContentObj == null || recipientIdObj == null) return;

        Long messageId = Long.valueOf(msgIdObj.toString());
        String newContent = newContentObj.toString().trim();
        Long recipientId = Long.valueOf(recipientIdObj.toString());

        // Validate content length
        if (newContent.isEmpty() || newContent.length() > MAX_CONTENT_LENGTH) {
            log.warn("Invalid edit content from user {}", senderId);
            return;
        }

        Instant editedAt = Instant.now();

        // Persist edit in DB asynchronously
        chatService.editMessageAsync(messageId, senderId, newContent, editedAt);

        // Broadcast edit to the recipient in real-time
        notificationService.broadcastMessageEdit(recipientId, messageId, newContent, editedAt);

        log.debug("Message {} edited by user {}", messageId, senderId);
    }

    /**
     * Handle view-change events for smart notification suppression.
     * The client sends this when the user navigates between sections.
     */
    @MessageMapping("/chat.view")
    public void updateActiveView(@Payload Map<String, Object> payload,
                                 SimpMessageHeaderAccessor headerAccessor) {

        Long userId = getUserIdFromSession(headerAccessor);
        if (userId == null) return;

        Object viewObj = payload.get("view");
        String view = viewObj != null ? viewObj.toString() : "unknown";

        // Store in the presence tracker via session attributes
        Map<String, Object> sessionAttrs = headerAccessor.getSessionAttributes();
        if (sessionAttrs != null) {
            sessionAttrs.put("activeView", view);
        }

        log.debug("User {} active view: {}", userId, view);
    }

    // ── Helpers ──────────────────────────────────────────────

    private Long getUserIdFromSession(SimpMessageHeaderAccessor headerAccessor) {
        Map<String, Object> sessionAttrs = headerAccessor.getSessionAttributes();
        if (sessionAttrs == null) return null;
        Object userId = sessionAttrs.get("userId");
        return userId instanceof Long ? (Long) userId : null;
    }

    private boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }

    private String truncate(String s, int maxLen) {
        if (s == null) return "";
        return s.length() <= maxLen ? s : s.substring(0, maxLen) + "…";
    }
}
