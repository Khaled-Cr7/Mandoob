/*
  Warnings:

  - The `brand` column on the `Phone` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "Brand" AS ENUM ('SAMSUNG', 'HONOR', 'TECHNO', 'INFINIX');

-- AlterTable
ALTER TABLE "Phone" DROP COLUMN "brand",
ADD COLUMN     "brand" "Brand" NOT NULL DEFAULT 'SAMSUNG';
