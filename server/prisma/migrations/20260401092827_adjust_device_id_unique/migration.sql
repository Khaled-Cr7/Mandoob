/*
  Warnings:

  - A unique constraint covering the columns `[deviceId]` on the table `ValidationCode` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ValidationCode_deviceId_key" ON "ValidationCode"("deviceId");
