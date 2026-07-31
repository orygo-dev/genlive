-- AlterTable
ALTER TABLE `users` MODIFY `password_hash` VARCHAR(255) NULL,
    ADD COLUMN `google_sub` VARCHAR(255) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `users_google_sub_key` ON `users`(`google_sub`);

-- AlterTable
ALTER TABLE `organizations` ADD COLUMN `brand_name` VARCHAR(100) NULL,
    ADD COLUMN `logo_url` VARCHAR(1000) NULL,
    ADD COLUMN `primary_color` VARCHAR(20) NULL,
    ADD COLUMN `custom_domain` VARCHAR(255) NULL,
    ADD COLUMN `sso_enabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `sso_provider` VARCHAR(40) NULL,
    ADD COLUMN `sso_client_id` VARCHAR(255) NULL,
    ADD COLUMN `sso_tenant_hint` VARCHAR(255) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `organizations_custom_domain_key` ON `organizations`(`custom_domain`);
