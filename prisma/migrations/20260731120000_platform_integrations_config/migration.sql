-- AlterTable
ALTER TABLE `platform_settings`
  ADD COLUMN `integrations_cipher` LONGTEXT NULL,
  ADD COLUMN `plan_catalog` JSON NULL;
