-- AlterTable
ALTER TABLE "Credential" ADD COLUMN "webEnabled" BOOLEAN NOT NULL DEFAULT false;

-- BackfillData: set webEnabled=true for credentials that have non-empty username or password
UPDATE "Credential" SET "webEnabled" = true WHERE "username" != '' OR "password" != '';
