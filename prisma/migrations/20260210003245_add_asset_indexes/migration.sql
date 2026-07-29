-- CreateIndex
CREATE INDEX "Asset_establishmentId_idx" ON "Asset"("establishmentId");

-- CreateIndex
CREATE INDEX "Asset_dependencyId_idx" ON "Asset"("dependencyId");

-- CreateIndex
CREATE INDEX "Asset_assetStateId_idx" ON "Asset"("assetStateId");

-- CreateIndex
CREATE INDEX "Asset_assetTypeId_idx" ON "Asset"("assetTypeId");

-- CreateIndex
CREATE INDEX "Asset_acquisitionDate_idx" ON "Asset"("acquisitionDate");

-- CreateIndex
CREATE INDEX "Asset_internalCode_idx" ON "Asset"("internalCode");
