-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` CHAR(36) NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `active_organization_id` CHAR(36) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `sessions_token_hash_key`(`token_hash`),
    INDEX `sessions_user_id_idx`(`user_id`),
    INDEX `sessions_expires_at_idx`(`expires_at`),
    INDEX `sessions_active_organization_id_idx`(`active_organization_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `organizations` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `plan_code` ENUM('FREE', 'PRO') NOT NULL DEFAULT 'FREE',
    `plan_expires_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `organizations_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `organization_invitations` (
    `id` CHAR(36) NOT NULL,
    `organization_id` CHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `role` ENUM('OWNER', 'ADMIN', 'MEMBER') NOT NULL DEFAULT 'MEMBER',
    `token_hash` CHAR(64) NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `invited_by_id` CHAR(36) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `accepted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `organization_invitations_token_hash_key`(`token_hash`),
    INDEX `organization_invitations_organization_id_status_idx`(`organization_id`, `status`),
    INDEX `organization_invitations_email_status_idx`(`email`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` CHAR(36) NOT NULL,
    `organization_id` CHAR(36) NOT NULL,
    `actor_id` CHAR(36) NULL,
    `action` VARCHAR(80) NOT NULL,
    `target_type` VARCHAR(80) NOT NULL,
    `target_id` VARCHAR(120) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_organization_id_created_at_idx`(`organization_id`, `created_at`),
    INDEX `audit_logs_actor_id_idx`(`actor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `organization_members` (
    `id` CHAR(36) NOT NULL,
    `organization_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `role` ENUM('OWNER', 'ADMIN', 'MEMBER') NOT NULL DEFAULT 'MEMBER',
    `joined_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `organization_members_user_id_idx`(`user_id`),
    UNIQUE INDEX `organization_members_organization_id_user_id_key`(`organization_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `meetings` (
    `id` CHAR(36) NOT NULL,
    `organization_id` CHAR(36) NOT NULL,
    `created_by_id` CHAR(36) NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `room_name` VARCHAR(64) NOT NULL,
    `password_hash` VARCHAR(255) NULL,
    `waiting_room` BOOLEAN NOT NULL DEFAULT true,
    `status` ENUM('SCHEDULED', 'ACTIVE', 'ENDED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    `starts_at` DATETIME(3) NULL,
    `actual_started_at` DATETIME(3) NULL,
    `ended_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `meetings_room_name_key`(`room_name`),
    INDEX `meetings_organization_id_starts_at_idx`(`organization_id`, `starts_at`),
    INDEX `meetings_created_by_id_idx`(`created_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `meeting_invites` (
    `id` CHAR(36) NOT NULL,
    `meeting_id` CHAR(36) NOT NULL,
    `channel` ENUM('EMAIL', 'WHATSAPP') NOT NULL,
    `recipient` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NULL,
    `phone_e164` VARCHAR(20) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `meeting_invites_meeting_id_idx`(`meeting_id`),
    INDEX `meeting_invites_phone_e164_idx`(`phone_e164`),
    UNIQUE INDEX `meeting_invites_meeting_id_channel_recipient_key`(`meeting_id`, `channel`, `recipient`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reminder_sent` (
    `id` CHAR(36) NOT NULL,
    `meeting_id` CHAR(36) NOT NULL,
    `kind` ENUM('INVITE', 'T_MINUS_24H', 'T_MINUS_1H') NOT NULL,
    `channel` ENUM('EMAIL', 'WHATSAPP') NOT NULL,
    `recipient` VARCHAR(255) NOT NULL,
    `provider_ref` VARCHAR(128) NULL,
    `status` VARCHAR(32) NOT NULL,
    `sent_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reminder_sent_meeting_id_kind_idx`(`meeting_id`, `kind`),
    UNIQUE INDEX `reminder_sent_meeting_id_kind_channel_recipient_key`(`meeting_id`, `kind`, `channel`, `recipient`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recordings` (
    `id` CHAR(36) NOT NULL,
    `meeting_id` CHAR(36) NOT NULL,
    `organization_id` CHAR(36) NOT NULL,
    `started_by_id` CHAR(36) NULL,
    `egress_id` VARCHAR(128) NOT NULL,
    `status` ENUM('STARTING', 'ACTIVE', 'ENDING', 'COMPLETE', 'FAILED', 'ABORTED') NOT NULL DEFAULT 'STARTING',
    `filepath` VARCHAR(512) NULL,
    `download_url` VARCHAR(1000) NULL,
    `duration_seconds` INTEGER NULL,
    `error_message` VARCHAR(500) NULL,
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ended_at` DATETIME(3) NULL,

    UNIQUE INDEX `recordings_egress_id_key`(`egress_id`),
    INDEX `recordings_meeting_id_started_at_idx`(`meeting_id`, `started_at`),
    INDEX `recordings_organization_id_started_at_idx`(`organization_id`, `started_at`),
    INDEX `recordings_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_orders` (
    `id` CHAR(36) NOT NULL,
    `organization_id` CHAR(36) NOT NULL,
    `created_by_id` CHAR(36) NOT NULL,
    `provider` ENUM('MIDTRANS', 'IPAYMU', 'FLIP') NOT NULL,
    `plan_code` ENUM('FREE', 'PRO') NOT NULL,
    `order_id` VARCHAR(64) NOT NULL,
    `amount_idr` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `provider_ref` VARCHAR(191) NULL,
    `checkout_url` VARCHAR(1000) NULL,
    `paid_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payment_orders_order_id_key`(`order_id`),
    INDEX `payment_orders_organization_id_created_at_idx`(`organization_id`, `created_at`),
    INDEX `payment_orders_status_created_at_idx`(`status`, `created_at`),
    INDEX `payment_orders_provider_status_idx`(`provider`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `meeting_participants` (
    `id` CHAR(36) NOT NULL,
    `meeting_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NULL,
    `livekit_identity` VARCHAR(128) NOT NULL,
    `display_name` VARCHAR(80) NOT NULL,
    `role` ENUM('HOST', 'MODERATOR', 'PARTICIPANT') NOT NULL DEFAULT 'PARTICIPANT',
    `admission_status` ENUM('WAITING', 'ADMITTED', 'REJECTED') NOT NULL DEFAULT 'ADMITTED',
    `admission_token_hash` CHAR(64) NULL,
    `admission_expires_at` DATETIME(3) NULL,
    `admission_consumed_at` DATETIME(3) NULL,
    `requested_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `joined_at` DATETIME(3) NULL,
    `left_at` DATETIME(3) NULL,
    `duration_seconds` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `meeting_participants_admission_token_hash_key`(`admission_token_hash`),
    INDEX `meeting_participants_meeting_id_joined_at_idx`(`meeting_id`, `joined_at`),
    INDEX `meeting_participants_user_id_idx`(`user_id`),
    UNIQUE INDEX `meeting_participants_meeting_id_livekit_identity_key`(`meeting_id`, `livekit_identity`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `livekit_webhook_events` (
    `id` CHAR(36) NOT NULL,
    `event_id` VARCHAR(80) NOT NULL,
    `event_type` VARCHAR(80) NOT NULL,
    `processed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `livekit_webhook_events_event_id_key`(`event_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_active_organization_id_fkey` FOREIGN KEY (`active_organization_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_invitations` ADD CONSTRAINT `organization_invitations_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_invitations` ADD CONSTRAINT `organization_invitations_invited_by_id_fkey` FOREIGN KEY (`invited_by_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_members` ADD CONSTRAINT `organization_members_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_members` ADD CONSTRAINT `organization_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `meetings` ADD CONSTRAINT `meetings_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `meetings` ADD CONSTRAINT `meetings_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `meeting_invites` ADD CONSTRAINT `meeting_invites_meeting_id_fkey` FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reminder_sent` ADD CONSTRAINT `reminder_sent_meeting_id_fkey` FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recordings` ADD CONSTRAINT `recordings_meeting_id_fkey` FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recordings` ADD CONSTRAINT `recordings_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recordings` ADD CONSTRAINT `recordings_started_by_id_fkey` FOREIGN KEY (`started_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_orders` ADD CONSTRAINT `payment_orders_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_orders` ADD CONSTRAINT `payment_orders_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `meeting_participants` ADD CONSTRAINT `meeting_participants_meeting_id_fkey` FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `meeting_participants` ADD CONSTRAINT `meeting_participants_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
