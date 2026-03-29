-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatar" TEXT NOT NULL DEFAULT 'https://ui-avatars.com/api/?name=User&background=random',
ADD COLUMN     "phoneNumber" TEXT NOT NULL DEFAULT '0000000000';
