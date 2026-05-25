-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AdminUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT 'user',
    "mfaSecret" TEXT NOT NULL DEFAULT '',
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "activated" BOOLEAN NOT NULL DEFAULT false,
    "activationToken" TEXT NOT NULL DEFAULT '',
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "mustSetupMfa" BOOLEAN NOT NULL DEFAULT true,
    "passwordChangedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AdminUser" ("createdAt", "email", "id", "mfaEnabled", "mfaSecret", "mustChangePassword", "mustSetupMfa", "password", "passwordChangedAt", "role", "updatedAt", "username") SELECT "createdAt", "email", "id", "mfaEnabled", "mfaSecret", "mustChangePassword", "mustSetupMfa", "password", "passwordChangedAt", "role", "updatedAt", "username" FROM "AdminUser";
DROP TABLE "AdminUser";
ALTER TABLE "new_AdminUser" RENAME TO "AdminUser";
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");
-- Mark all existing users as activated (they already have passwords)
UPDATE "AdminUser" SET "activated" = true WHERE "password" != '';
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
