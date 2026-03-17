package com.nisconnect.listener;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Listens for WebSocket session lifecycle events.
 *
 * ── Connection Drop Handling ──────────────────────────────────
 * When a user's WebSocket connection drops (network issue, browser close, etc.):
 *   1. STOMP heartbeat misses trigger a SessionDisconnectEvent
 *   2. This listener removes the user from the online-users map
 *   3. Broadcasts "user went offline" to their contacts
 *
 * ── Active View Tracking ──────────────────────────────────────
 * Tracks which section each user is viewing (chat, feed, etc.) to enable
 * context-aware notification suppression. Updated via /app/chat.view.
 *
 * ── Scalability ───────────────────────────────────────────────
 * The ConcurrentHashMap tracks online users for this server instance.
 * For multi-instance deployment, swap to Redis Pub/Sub for presence tracking.
 */
@Component
public class WebSocketEventListener {

    private static final Logger log = LoggerFactory.getLogger(WebSocketEventListener.class);

    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Maps userId → WebSocket sessionId.
     * Thread-safe for concurrent connect/disconnect events.
     */
    private final Map<Long, String> onlineUsers = new ConcurrentHashMap<>();

    /**
     * Maps userId → active view (chat, feed, profile, etc.).
     * Used for context-aware notification suppression.
     */
    private final Map<Long, String> activeViews = new ConcurrentHashMap<>();

    public WebSocketEventListener(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    @EventListener
    public void handleConnect(SessionConnectEvent event) {
        SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.wrap(event.getMessage());
        Map<String, Object> sessionAttrs = headers.getSessionAttributes();

        if (sessionAttrs != null && sessionAttrs.containsKey("userId")) {
            Long userId = (Long) sessionAttrs.get("userId");
            String wsSessionId = headers.getSessionId();

            onlineUsers.put(userId, wsSessionId);
            activeViews.put(userId, "unknown");
            log.info("User connected: userId={}, wsSession={}, totalOnline={}",
                    userId, wsSessionId, onlineUsers.size());

            // Broadcast "user online" to their contacts
            broadcastPresence(userId, "online");
        }
    }

    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {
        SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.wrap(event.getMessage());
        Map<String, Object> sessionAttrs = headers.getSessionAttributes();

        if (sessionAttrs != null && sessionAttrs.containsKey("userId")) {
            Long userId = (Long) sessionAttrs.get("userId");
            onlineUsers.remove(userId);
            activeViews.remove(userId);

            log.info("User disconnected: userId={}, reason={}, totalOnline={}",
                    userId, event.getCloseStatus(), onlineUsers.size());

            // Broadcast "user offline" to their contacts
            broadcastPresence(userId, "offline");
        }
    }

    /**
     * Broadcast presence change to all connected users.
     */
    private void broadcastPresence(Long userId, String status) {
        try {
            messagingTemplate.convertAndSend("/topic/presence",
                    Map.of("userId", userId, "status", status));
        } catch (Exception e) {
            log.error("Failed to broadcast presence for user {}: {}", userId, e.getMessage());
        }
    }

    /**
     * Check if a user is currently online (has an active WebSocket connection).
     */
    public boolean isOnline(Long userId) {
        return onlineUsers.containsKey(userId);
    }

    /**
     * Get the count of currently connected users.
     */
    public int getOnlineCount() {
        return onlineUsers.size();
    }

    /**
     * Get the user's current active view (chat, feed, profile, etc.).
     * Returns "unknown" if not tracked.
     */
    public String getActiveView(Long userId) {
        return activeViews.getOrDefault(userId, "unknown");
    }

    /**
     * Update the user's active view. Called from ChatController when
     * the user navigates between sections.
     */
    public void setActiveView(Long userId, String view) {
        if (userId != null && view != null) {
            activeViews.put(userId, view);
        }
    }
}
