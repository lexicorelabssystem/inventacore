CREATE TABLE "DepreciationRun" (
    "id" SERIAL NOT NULL,
    "institutionId" INTEGER NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "closingDate" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedById" INTEGER,
    "totalAssets" INTEGER NOT NULL DEFAULT 0,
    "totalAnnualDepreciation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalClosingBookValue" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "DepreciationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DepreciationRunItem" (
    "id" SERIAL NOT NULL,
    "depreciationRunId" INTEGER NOT NULL,
    "assetId" INTEGER,
    "assetInternalCode" INTEGER NOT NULL,
    "assetName" TEXT NOT NULL,
    "establishmentId" INTEGER,
    "establishmentName" TEXT,
    "dependencyId" INTEGER,
    "dependencyName" TEXT,
    "acquisitionValueSnapshot" DOUBLE PRECISION NOT NULL,
    "depreciationStartDateSnapshot" TIMESTAMP(3),
    "usefulLifeYearsSnapshot" INTEGER,
    "depreciationAnnualValueSnapshot" DOUBLE PRECISION,
    "residualAmountSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "openingBookValue" DOUBLE PRECISION NOT NULL,
    "annualDepreciation" DOUBLE PRECISION NOT NULL,
    "closingBookValue" DOUBLE PRECISION NOT NULL,
    "accumulatedDepreciation" DOUBLE PRECISION NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepreciationRunItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DepreciationRun_institutionId_fiscalYear_key" ON "DepreciationRun"("institutionId", "fiscalYear");
CREATE INDEX "DepreciationRun_institutionId_idx" ON "DepreciationRun"("institutionId");
CREATE INDEX "DepreciationRun_fiscalYear_idx" ON "DepreciationRun"("fiscalYear");
CREATE UNIQUE INDEX "DepreciationRunItem_depreciationRunId_assetId_key" ON "DepreciationRunItem"("depreciationRunId", "assetId");
CREATE INDEX "DepreciationRunItem_depreciationRunId_idx" ON "DepreciationRunItem"("depreciationRunId");
CREATE INDEX "DepreciationRunItem_assetId_idx" ON "DepreciationRunItem"("assetId");

ALTER TABLE "DepreciationRun"
ADD CONSTRAINT "DepreciationRun_institutionId_fkey"
FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DepreciationRun"
ADD CONSTRAINT "DepreciationRun_closedById_fkey"
FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DepreciationRunItem"
ADD CONSTRAINT "DepreciationRunItem_depreciationRunId_fkey"
FOREIGN KEY ("depreciationRunId") REFERENCES "DepreciationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DepreciationRunItem"
ADD CONSTRAINT "DepreciationRunItem_assetId_fkey"
FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
