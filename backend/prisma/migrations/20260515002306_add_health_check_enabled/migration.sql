-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Resource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "group" TEXT NOT NULL DEFAULT 'default',
    "loginMode" TEXT NOT NULL DEFAULT 'link',
    "description" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "healthCheckEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Resource" ("createdAt", "description", "enabled", "group", "id", "loginMode", "name", "sortOrder", "updatedAt", "url") SELECT "createdAt", "description", "enabled", "group", "id", "loginMode", "name", "sortOrder", "updatedAt", "url" FROM "Resource";
DROP TABLE "Resource";
ALTER TABLE "new_Resource" RENAME TO "Resource";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
