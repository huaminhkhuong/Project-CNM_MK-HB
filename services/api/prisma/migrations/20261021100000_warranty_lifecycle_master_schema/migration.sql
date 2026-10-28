-- Migration: Warranty Lifecycle, Requests, Events, Attachments, Notifications Master Schema
CREATE TABLE IF NOT EXISTS `warranty_requests` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `warranty_id` INT NULL,
  `user_id` INT NULL,
  `lookup_value` VARCHAR(255) NULL,
  `customer_name` VARCHAR(255) NULL,
  `customer_phone` VARCHAR(50) NULL,
  `customer_email` VARCHAR(255) NULL,
  `product_name` VARCHAR(255) NULL,
  `serial_number` VARCHAR(255) NULL,
  `order_id` INT NULL,
  `severity` VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
  `issue_description` TEXT NOT NULL,
  `extra_note` TEXT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'RECEIVED',
  `last_staff_note` TEXT NULL,
  `last_email_mock` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_warranty_requests_user` (`user_id`),
  INDEX `idx_warranty_requests_order` (`order_id`),
  INDEX `idx_warranty_requests_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `warranty_request_events` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `request_id` INT NOT NULL,
  `status` VARCHAR(50) NOT NULL,
  `note` TEXT NULL,
  `actor_role` VARCHAR(50) NULL,
  `actor_name` VARCHAR(255) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_warranty_events_request` (`request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `warranty_request_attachments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `request_id` INT NOT NULL,
  `source` VARCHAR(50) NOT NULL DEFAULT 'CUSTOMER',
  `file_url` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(120) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_warranty_attachments_request` (`request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `warranty_notifications` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `request_id` INT NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `is_read` SMALLINT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_warranty_notifications_user` (`user_id`),
  INDEX `idx_warranty_notifications_read` (`user_id`, `is_read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
