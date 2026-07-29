-- CreateTable
CREATE TABLE "Dependency" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "establishmentId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "minUtmValue" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "AssetType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetState" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "AssetState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" SERIAL NOT NULL,
    "internalCode" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "modelName" TEXT,
    "serialNumber" TEXT,
    "acquisitionValue" DOUBLE PRECISION NOT NULL,
    "acquisitionDate" TIMESTAMP(3) NOT NULL,
    "assetTypeId" INTEGER NOT NULL,
    "assetStateId" INTEGER NOT NULL,
    "establishmentId" INTEGER NOT NULL,
    "dependencyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssetType_name_key" ON "AssetType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AssetState_name_key" ON "AssetState"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_internalCode_key" ON "Asset"("internalCode");

-- AddForeignKey
ALTER TABLE "Dependency" ADD CONSTRAINT "Dependency_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_assetTypeId_fkey" FOREIGN KEY ("assetTypeId") REFERENCES "AssetType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_assetStateId_fkey" FOREIGN KEY ("assetStateId") REFERENCES "AssetState"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_dependencyId_fkey" FOREIGN KEY ("dependencyId") REFERENCES "Dependency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
