-- AlterTable: Add OIDC subject identifier to AdminUser
ALTER TABLE "AdminUser" ADD COLUMN "oidcSub" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "AdminUser_oidcSub_idx" ON "AdminUser"("oidcSub");
