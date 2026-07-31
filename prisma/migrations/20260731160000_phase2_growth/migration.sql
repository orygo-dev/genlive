-- AlterTable
ALTER TABLE `organizations` ADD COLUMN `recording_retention_days` INTEGER NULL;

-- AlterTable
ALTER TABLE `recordings` ADD COLUMN `consent_acknowledged_at` DATETIME(3) NULL,
    ADD COLUMN `consent_by_user_id` CHAR(36) NULL;

-- CreateTable
CREATE TABLE `plan_reminder_logs` (
    `id` CHAR(36) NOT NULL,
    `organization_id` CHAR(36) NOT NULL,
    `kind` ENUM('T_MINUS_7D', 'T_MINUS_3D', 'T_MINUS_1D', 'EXPIRED') NOT NULL,
    `period_key` VARCHAR(10) NOT NULL,
    `sent_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `plan_reminder_logs_organization_id_sent_at_idx`(`organization_id`, `sent_at`),
    UNIQUE INDEX `plan_reminder_logs_organization_id_kind_period_key_key`(`organization_id`, `kind`, `period_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `recordings` ADD CONSTRAINT `recordings_consent_by_user_id_fkey` FOREIGN KEY (`consent_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `plan_reminder_logs` ADD CONSTRAINT `plan_reminder_logs_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
