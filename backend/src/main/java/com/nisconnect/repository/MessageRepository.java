package com.nisconnect.repository;

import com.nisconnect.model.MessageEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MessageRepository extends JpaRepository<MessageEntity, Long> {

    /**
     * Fetch messages for a conversation, ordered by creation time (ascending).
     * Uses the composite index idx_msg_conv_created for fast lookups.
     */
    List<MessageEntity> findByConversationIdOrderByCreatedAtAsc(Long conversationId, Pageable pageable);

    /**
     * Fetch messages after a specific message ID (for reconnection catch-up).
     * Used when a client reconnects and needs to fetch missed messages.
     */
    @Query("SELECT m FROM MessageEntity m WHERE m.conversationId = :convId AND m.id > :afterId ORDER BY m.createdAt ASC")
    List<MessageEntity> findMessagesAfter(Long convId, Long afterId);

    /**
     * Count unread messages in a conversation for a specific user.
     * A message is "unread" if the sender is NOT the current user and readStatus = false.
     */
    @Query("SELECT COUNT(m) FROM MessageEntity m WHERE m.conversationId = :convId AND m.senderId != :userId AND m.readStatus = false")
    long countUnread(Long convId, Long userId);

    /**
     * Mark all messages in a conversation as read for a specific user.
     */
    @Modifying
    @Query("UPDATE MessageEntity m SET m.readStatus = true WHERE m.conversationId = :convId AND m.senderId != :userId AND m.readStatus = false")
    int markAsRead(Long convId, Long userId);

    /**
     * Find all unread messages in a conversation that were NOT sent by the given user.
     * Used for bulk read-receipt marking.
     */
    List<MessageEntity> findByConversationIdAndSenderIdNotAndReadAtIsNull(Long conversationId, Long senderId);
}
