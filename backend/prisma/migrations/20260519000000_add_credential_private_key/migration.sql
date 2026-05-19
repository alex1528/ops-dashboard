-- AlterTable: add privateKey column to Credential
ALTER TABLE "Credential" ADD COLUMN "privateKey" TEXT NOT NULL DEFAULT '';
