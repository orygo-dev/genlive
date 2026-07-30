-- AlterTable
ALTER TABLE `users` ADD COLUMN `is_super_admin` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `platform_settings` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `app_name` VARCHAR(80) NOT NULL DEFAULT 'GenMeet',
    `logo_url` VARCHAR(1000) NULL,
    `login_background_url` VARCHAR(1000) NULL,
    `splash_background_url` VARCHAR(1000) NULL,
    `splash_logo_url` VARCHAR(1000) NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by_id` CHAR(36) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed singleton row
INSERT INTO `platform_settings` (`id`, `app_name`, `updated_at`)
VALUES (1, 'GenMeet', CURRENT_TIMESTAMP(3));
