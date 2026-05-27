-- AlterTable
ALTER TABLE "Credential" ADD COLUMN "webEnabled" BOOLEAN NOT NULL DEFAULT false;

-- BackfillData: set webEnabled=true for credentials that have actual web username/password content
-- encrypt('') produces exactly 58 chars (24-char IV + ':' + 32-char tag + ':'), actual data is longer
-- Also handle legacy plaintext credentials (non-encrypted, non-empty, doesn't match iv:tag:ct format)
UPDATE "Credential" SET "webEnabled" = true
WHERE LENGTH("username") > 58
   OR (LENGTH("username") > 0 AND LENGTH("username") != 58);
