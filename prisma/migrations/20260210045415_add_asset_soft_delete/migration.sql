-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" INTEGER,
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Asset_isDeleted_idx" ON "Asset"("isDeleted");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
