-- CreateEnum
CREATE TYPE "AssetActionType" AS ENUM ('CREATE', 'RELOCATE', 'STATUS_CHANGE');

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "accountingAccount" TEXT,
ADD COLUMN     "analyticCode" TEXT;

-- AlterTable
ALTER TABLE "Establishment" ADD COLUMN     "commune" TEXT,
ADD COLUMN     "rbd" TEXT;

-- CreateTable
CREATE TABLE "AssetAudit" (
    "id" SERIAL NOT NULL,
    "action" "AssetActionType" NOT NULL,
    "assetId" INTEGER NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetImportBatch" (
    "id" SERIAL NOT NULL,
    "filename" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AssetImportBatch_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AssetAudit" ADD CONSTRAINT "AssetAudit_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAudit" ADD CONSTRAINT "AssetAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetImportBatch" ADD CONSTRAINT "AssetImportBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
