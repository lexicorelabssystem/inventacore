ALTER TABLE "CatalogItem"
ADD COLUMN "officialKey" TEXT;

CREATE UNIQUE INDEX "CatalogItem_officialKey_key"
ON "CatalogItem"("officialKey");
