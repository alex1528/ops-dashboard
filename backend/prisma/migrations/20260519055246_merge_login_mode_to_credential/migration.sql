/*
  Warnings:

  - You are about to drop the column `loginMode` on the `Resource` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Credential" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "resourceId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "extra" TEXT NOT NULL DEFAULT '',
    "privateKey" TEXT NOT NULL DEFAULT '',
    "sshEnabled" BOOLEAN NOT NULL DEFAULT false,
    "webLoginEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Credential_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Credential" ("createdAt", "extra", "id", "password", "privateKey", "resourceId", "sshEnabled", "updatedAt", "username") SELECT "createdAt", "extra", "id", "password", "privateKey", "resourceId", "sshEnabled", "updatedAt", "username" FROM "Credential";
DROP TABLE "Credential";
ALTER TABLE "new_Credential" RENAME TO "Credential";
CREATE UNIQUE INDEX "Credential_resourceId_key" ON "Credential"("resourceId");
CREATE TABLE "new_Resource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "group" TEXT NOT NULL DEFAULT 'default',
    "groupSortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "healthCheckEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Resource" ("createdAt", "description", "enabled", "group", "groupSortOrder", "healthCheckEnabled", "id", "name", "sortOrder", "updatedAt", "url") SELECT "createdAt", "description", "enabled", "group", "groupSortOrder", "healthCheckEnabled", "id", "name", "sortOrder", "updatedAt", "url" FROM "Resource";
DROP TABLE "Resource";
ALTER TABLE "new_Resource" RENAME TO "Resource";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
