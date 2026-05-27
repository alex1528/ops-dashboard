-- Fix: Reset webEnabled for all credentials, then set correctly
-- The previous backfill incorrectly set webEnabled=true for SSH-only credentials
-- because encrypt('') produces a non-empty 58-char string

-- Step 1: Reset all to false
UPDATE "Credential" SET "webEnabled" = false;

-- Step 2: Only set true for credentials that have actual web username data
-- encrypt('') produces exactly 58 chars (24-char hex IV + ':' + 32-char hex tag + ':')
-- Actual encrypted content produces > 58 chars
-- Legacy plaintext credentials would be != 58 chars and > 0 chars
UPDATE "Credential" SET "webEnabled" = true
WHERE LENGTH("username") > 58
   OR (LENGTH("username") > 0 AND LENGTH("username") < 58);
