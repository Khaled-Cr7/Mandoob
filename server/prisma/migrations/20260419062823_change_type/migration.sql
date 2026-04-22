/*
  Warnings:

  - The values [DELETED] on the enum `ChangeType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ChangeType_new" AS ENUM ('ADDED', 'PRICE_UPDATE');
ALTER TABLE "public"."Notification" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "ChangeType_new" USING ("type"::text::"ChangeType_new");
ALTER TABLE "SystemChange" ALTER COLUMN "type" TYPE "ChangeType_new" USING ("type"::text::"ChangeType_new");
ALTER TYPE "ChangeType" RENAME TO "ChangeType_old";
ALTER TYPE "ChangeType_new" RENAME TO "ChangeType";
DROP TYPE "public"."ChangeType_old";
ALTER TABLE "Notification" ALTER COLUMN "type" SET DEFAULT 'ADDED';
COMMIT;
