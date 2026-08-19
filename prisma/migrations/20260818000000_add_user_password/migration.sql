-- AlterTable: Add passwordHash column to User table
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT NOT NULL DEFAULT '';
