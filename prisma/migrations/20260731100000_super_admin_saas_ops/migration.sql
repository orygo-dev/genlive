-- AlterTable
ALTER TABLE `users` ADD COLUMN `is_disabled` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `platform_settings` ADD COLUMN `support_email` VARCHAR(255) NULL,
    ADD COLUMN `maintenance_mode` BOOLEAN NOT NULL DEFAULT false;
