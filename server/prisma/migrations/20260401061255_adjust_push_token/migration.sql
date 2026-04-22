/*
  Warnings:

  - You are about to drop the column `pushToken` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "pushToken";

-- AlterTable
ALTER TABLE "UserDevice" ADD COLUMN     "pushToken" TEXT;
