package com.nisconnect.model;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * JPA entity mapped to the existing `messages` table.
 *
 * Index strategy (applied in V2__optimize_messages.sql):
 *   idx_msg_conv_created  — fast message retrieval sorted by time within a conversation
 *   idx_msg_unread        — efficient unread-count queries
 */
@Entity
@Table(name = "messages")
public class MessageEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "conversation_id", nullable = false)
    private Long conversationId;

    @Column(name = "sender_id", nullable = false)
    private Long senderId;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(name = "attachment_path", length = 500)
    private String attachmentPath;

    @Column(name = "attachment_type", length = 50)
    private String attachmentType;

    @Column(name = "read_status", nullable = false)
    private Boolean readStatus = false;

    /** Timestamp when the message was read by the recipient (null = unread) */
    @Column(name = "read_at")
    private Instant readAt;

    /** Timestamp when the message was last edited (null = never edited) */
    @Column(name = "edited_at")
    private Instant editedAt;

    @Column(name = "created_at", nullable = false,
            insertable = false, updatable = false)
    private Instant createdAt;

    // ── Constructors ─────────────────────────────────────────

    public MessageEntity() {}

    public MessageEntity(Long conversationId, Long senderId, String content,
                         String attachmentPath, String attachmentType) {
        this.conversationId = conversationId;
        this.senderId = senderId;
        this.content = content;
        this.attachmentPath = attachmentPath;
        this.attachmentType = attachmentType;
        this.readStatus = false;
    }

    // ── Getters & Setters ────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getConversationId() { return conversationId; }
    public void setConversationId(Long conversationId) { this.conversationId = conversationId; }

    public Long getSenderId() { return senderId; }
    public void setSenderId(Long senderId) { this.senderId = senderId; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getAttachmentPath() { return attachmentPath; }
    public void setAttachmentPath(String attachmentPath) { this.attachmentPath = attachmentPath; }

    public String getAttachmentType() { return attachmentType; }
    public void setAttachmentType(String attachmentType) { this.attachmentType = attachmentType; }

    public Boolean getReadStatus() { return readStatus; }
    public void setReadStatus(Boolean readStatus) { this.readStatus = readStatus; }

    public Instant getReadAt() { return readAt; }
    public void setReadAt(Instant readAt) { this.readAt = readAt; }

    public Instant getEditedAt() { return editedAt; }
    public void setEditedAt(Instant editedAt) { this.editedAt = editedAt; }

    public Instant getCreatedAt() { return createdAt; }
}
