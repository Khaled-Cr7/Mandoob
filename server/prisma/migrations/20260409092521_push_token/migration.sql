/*
  Warnings:

  - A unique constraint covering the columns `[pushToken]` on the table `UserDevice` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "UserDevice_pushToken_key" ON "UserDevice"("pushToken");
