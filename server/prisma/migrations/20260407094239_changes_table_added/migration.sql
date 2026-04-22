-- CreateEnum
CREATE TYPE "ChangeType" AS ENUM ('ADDED', 'DELETED', 'PRICE_UPDATE');

-- CreateTable
CREATE TABLE "SystemChange" (
    "id" SERIAL NOT NULL,
    "type" "ChangeType" NOT NULL,
    "modelName" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemChange_pkey" PRIMARY KEY ("id")
);
