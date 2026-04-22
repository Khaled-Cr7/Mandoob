/*
  Warnings:

  - Added the required column `userId` to the `SystemChange` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SystemChange" ADD COLUMN     "userId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "SystemChange" ADD CONSTRAINT "SystemChange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
