/*
  Warnings:

  - You are about to drop the column `message` on the `Notification` table. All the data in the column will be lost.
  - Added the required column `modelName` to the `Notification` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "message",
ADD COLUMN     "modelName" TEXT NOT NULL,
ADD COLUMN     "newPrice" TEXT,
ADD COLUMN     "oldPrice" TEXT,
ADD COLUMN     "type" "ChangeType" NOT NULL DEFAULT 'ADDED';
