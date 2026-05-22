-- AlterTable: 为 AdminUser 新增 mustChangePassword + passwordChangedAt 字段。
-- 通过 SQLite RedefineTable 模式实现：建新表 → 拷数据时显式回填 → 替换旧表。
-- 存量用户的 mustChangePassword 显式回填为 0（false），避免老用户在升级后被强制改密。
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_AdminUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT 'user',
    "mfaSecret" TEXT NOT NULL DEFAULT '',
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "passwordChangedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_AdminUser"
  ("id", "username", "password", "email", "role", "mfaSecret", "mfaEnabled",
   "mustChangePassword", "passwordChangedAt", "createdAt", "updatedAt")
SELECT
  "id", "username", "password", "email", "role", "mfaSecret", "mfaEnabled",
  0 AS "mustChangePassword",      -- 存量用户默认不强制改密
  NULL AS "passwordChangedAt",
  "createdAt", "updatedAt"
FROM "AdminUser";

DROP TABLE "AdminUser";
ALTER TABLE "new_AdminUser" RENAME TO "AdminUser";
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
