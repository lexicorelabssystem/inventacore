-- CreateIndex
CREATE INDEX "AssetAudit_assetId_idx" ON "AssetAudit"("assetId");

-- CreateIndex
CREATE INDEX "AssetAudit_userId_idx" ON "AssetAudit"("userId");

-- CreateIndex
CREATE INDEX "AssetAudit_createdAt_idx" ON "AssetAudit"("createdAt");

-- CreateIndex
CREATE INDEX "AssetAudit_action_idx" ON "AssetAudit"("action");
