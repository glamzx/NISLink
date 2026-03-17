package com.nisconnect.dto;

import java.time.Instant;

/**
 * Outbound DTO — pushed to the recipient via STOMP on /user/{id}/queue/messages
 *
 * Multi-purpose: serves as the payload for:
 *   - Regular messages (type = "message")
 *   - Message edits  (type = "edit")
 *   - Read receipts  (type = "read_receipt")
 *   - Typing events  (type = "typing")
 */
public class ChatMessageResponse {

    private Long id;
    private Long conversationId;
    private Long senderId;
    private String senderName;
    private String senderAvatar;
    private String content;
    private String attachmentPath;
    private String attachmentType;
    private Instant createdAt;

    /** Event type: "message", "edit", "read_receipt", "typing" */
    private String type = "message";

    /** When the message was read by the recipient (null if unread) */
    private Instant readAt;

    /** When the message was last edited (null if never edited) */
    private Instant editedAt;

    // ── Builder-style static factory ─────────────────────────

    public static ChatMessageResponse of(Long senderId, String senderName, String senderAvatar,
                                          String content, String attachmentPath, String attachmentType) {
        ChatMessageResponse r = new ChatMessageResponse();
        r.senderId = senderId;
        r.senderName = senderName;
        r.senderAvatar = senderAvatar;
        r.content = content;
        r.attachmentPath = attachmentPath;
        r.attachmentType = attachmentType;
        r.createdAt = Instant.now();
        r.type = "message";
        return r;
    }

    // ── Getters & Setters ────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getConversationId() { return conversationId; }
    public void setConversationId(Long conversationId) { this.conversationId = conversationId; }

    public Long getSenderId() { return senderId; }
    public void setSenderId(Long senderId) { this.senderId = senderId; }

    public String getSenderName() { return senderName; }
    public void setSenderName(String senderName) { this.senderName = senderName; }

    public String getSenderAvatar() { return senderAvatar; }
    public void setSenderAvatar(String senderAvatar) { this.senderAvatar = senderAvatar; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getAttachmentPath() { return attachmentPath; }
    public void setAttachmentPath(String attachmentPath) { this.attachmentPath = attachmentPath; }

    public String getAttachmentType() { return attachmentType; }
    public void setAttachmentType(String attachmentType) { this.attachmentType = attachmentType; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public Instant getReadAt() { return readAt; }
    public void setReadAt(Instant readAt) { this.readAt = readAt; }

    public Instant getEditedAt() { return editedAt; }
    public void setEditedAt(Instant editedAt) { this.editedAt = editedAt; }
}
