-- CreateTable
CREATE TABLE "AssetEvidence" (
    "id" SERIAL NOT NULL,
    "assetId" INTEGER NOT NULL,
    "movementId" INTEGER,
    "uploadedById" INTEGER NOT NULL,
    "docType" TEXT NOT NULL,
    "note" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssetEvidence_assetId_idx" ON "AssetEvidence"("assetId");

-- CreateIndex
CREATE INDEX "AssetEvidence_movementId_idx" ON "AssetEvidence"("movementId");

-- CreateIndex
CREATE INDEX "AssetEvidence_uploadedById_idx" ON "AssetEvidence"("uploadedById");

-- CreateIndex
CREATE INDEX "AssetEvidence_createdAt_idx" ON "AssetEvidence"("createdAt");

-- AddForeignKey
ALTER TABLE "AssetEvidence" ADD CONSTRAINT "AssetEvidence_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetEvidence" ADD CONSTRAINT "AssetEvidence_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "Movement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetEvidence" ADD CONSTRAINT "AssetEvidence_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
