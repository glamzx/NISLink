-- ============================================================
-- NIS Alumni — Database Schema (Full)
-- Run this in phpMyAdmin to create all tables.
-- ============================================================

CREATE DATABASE IF NOT EXISTS `nis_alumni`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `nis_alumni`;

-- -----------------------------------------------------------
-- Users table
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id`              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `email`           VARCHAR(255)    NOT NULL,
  `password_hash`   VARCHAR(255)    NOT NULL,
  `full_name`       VARCHAR(150)    NOT NULL DEFAULT '',
  `nis_branch`      VARCHAR(100)    DEFAULT NULL,
  `graduation_year` YEAR            DEFAULT NULL,
  `university`      VARCHAR(200)    DEFAULT NULL,
  `degree_major`    VARCHAR(200)    DEFAULT NULL,
  `bio`             TEXT            DEFAULT NULL,
  `status`          VARCHAR(100)    DEFAULT NULL,
  `linkedin`        VARCHAR(255)    DEFAULT NULL,
  `instagram`       VARCHAR(255)    DEFAULT NULL,
  `youtube`         VARCHAR(255)    DEFAULT NULL,
  `avatar_url`      VARCHAR(500)    DEFAULT NULL,
  `cover_url`       VARCHAR(500)    DEFAULT NULL,
  `created_at`      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_email` (`email`)
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- User locations (Alumni Map)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_locations` (
  `id`          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`     INT UNSIGNED  NOT NULL,
  `latitude`    DECIMAL(10,7) NOT NULL,
  `longitude`   DECIMAL(10,7) NOT NULL,
  `updated_at`  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_location` (`user_id`),
  CONSTRAINT `fk_location_user`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- Posts / Publications (Feed & Profile Wall)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `posts` (
  `id`          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`     INT UNSIGNED  NOT NULL,
  `content`     TEXT          NOT NULL,
  `created_at`  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_posts_user` (`user_id`),
  KEY `idx_posts_created` (`created_at`),
  CONSTRAINT `fk_posts_user`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- Post Attachments (images, files)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `post_attachments` (
  `id`            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `post_id`       INT UNSIGNED  NOT NULL,
  `file_path`     VARCHAR(500)  NOT NULL,
  `file_type`     VARCHAR(50)   NOT NULL DEFAULT 'image',
  `original_name` VARCHAR(255)  DEFAULT NULL,
  `created_at`    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_attach_post` (`post_id`),
  CONSTRAINT `fk_attach_post`
    FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- Subscriptions / Follow system
-- (mutual = both users follow each other)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `subscriptions` (
  `id`            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `follower_id`   INT UNSIGNED  NOT NULL,
  `following_id`  INT UNSIGNED  NOT NULL,
  `created_at`    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_subscription` (`follower_id`, `following_id`),
  KEY `idx_sub_following` (`following_id`),
  CONSTRAINT `fk_sub_follower`
    FOREIGN KEY (`follower_id`) REFERENCES `users`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_sub_following`
    FOREIGN KEY (`following_id`) REFERENCES `users`(`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- Post Likes
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `post_likes` (
  `id`          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `post_id`     INT UNSIGNED  NOT NULL,
  `user_id`     INT UNSIGNED  NOT NULL,
  `created_at`  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_like` (`post_id`, `user_id`),
  KEY `idx_like_post` (`post_id`),
  KEY `idx_like_user` (`user_id`),
  CONSTRAINT `fk_like_post`
    FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_like_user`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- Post Comments
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `post_comments` (
  `id`          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `post_id`     INT UNSIGNED  NOT NULL,
  `user_id`     INT UNSIGNED  NOT NULL,
  `content`     TEXT          NOT NULL,
  `created_at`  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_comment_post` (`post_id`),
  KEY `idx_comment_user` (`user_id`),
  CONSTRAINT `fk_comment_post`
    FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_comment_user`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- Add cover_url column to users (run if table already exists)
-- -----------------------------------------------------------
ALTER TABLE `users` ADD COLUMN `cover_url` VARCHAR(500) DEFAULT NULL AFTER `avatar_url`;

-- -----------------------------------------------------------
-- Add username column to users (run if table already exists)
-- -----------------------------------------------------------
ALTER TABLE `users` ADD COLUMN `username` VARCHAR(30) DEFAULT NULL AFTER `id`;
ALTER TABLE `users` ADD UNIQUE KEY `uq_username` (`username`);

-- -----------------------------------------------------------
-- Conversations (private chat threads)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `conversations` (
  `id`          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_a`      INT UNSIGNED  NOT NULL,
  `user_b`      INT UNSIGNED  NOT NULL,
  `updated_at`  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_conversation` (`user_a`, `user_b`),
  CONSTRAINT `fk_conv_user_a`
    FOREIGN KEY (`user_a`) REFERENCES `users`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_conv_user_b`
    FOREIGN KEY (`user_b`) REFERENCES `users`(`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- Messages (private chat messages)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `messages` (
  `id`              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `conversation_id` INT UNSIGNED  NOT NULL,
  `sender_id`       INT UNSIGNED  NOT NULL,
  `content`         TEXT          DEFAULT NULL,
  `attachment_path` VARCHAR(500)  DEFAULT NULL,
  `attachment_type` VARCHAR(50)   DEFAULT NULL,
  `created_at`      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_msg_conv` (`conversation_id`),
  KEY `idx_msg_sender` (`sender_id`),
  CONSTRAINT `fk_msg_conv`
    FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_msg_sender`
    FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB;
