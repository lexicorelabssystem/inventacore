-- AlterEnum
ALTER TYPE "AdminEntityType" ADD VALUE 'CATALOG_ITEM';

-- DropIndex
DROP INDEX "idx_asset_brand_trgm";

-- DropIndex
DROP INDEX "idx_asset_model_trgm";

-- DropIndex
DROP INDEX "idx_asset_name_trgm";

-- DropIndex
DROP INDEX "idx_asset_serial_trgm";

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "catalogItemId" INTEGER;

-- CreateTable
CREATE TABLE "CatalogItem" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "brand" TEXT,
    "modelName" TEXT,
    "description" TEXT,
    "unit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CatalogItem_name_idx" ON "CatalogItem"("name");

-- CreateIndex
CREATE INDEX "CatalogItem_category_idx" ON "CatalogItem"("category");

-- CreateIndex
CREATE INDEX "CatalogItem_subcategory_idx" ON "CatalogItem"("subcategory");

-- CreateIndex
CREATE INDEX "CatalogItem_brand_idx" ON "CatalogItem"("brand");

-- CreateIndex
CREATE INDEX "CatalogItem_modelName_idx" ON "CatalogItem"("modelName");

-- CreateIndex
CREATE INDEX "Asset_catalogItemId_idx" ON "Asset"("catalogItemId");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
