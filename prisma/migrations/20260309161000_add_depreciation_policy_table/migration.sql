CREATE TABLE "DepreciationPolicy" (
  "id" SERIAL NOT NULL,
  "policyKey" TEXT NOT NULL,
  "accountingAccount" TEXT NOT NULL,
  "accountName" TEXT NOT NULL,
  "category" TEXT,
  "subcategory" TEXT,
  "usefulLifeYears" INTEGER NOT NULL,
  "annualRatePct" DOUBLE PRECISION NOT NULL,
  "method" TEXT NOT NULL DEFAULT 'LINEAL',
  "residualRatePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "appliesFrom" TIMESTAMP(3) NOT NULL,
  "observations" TEXT,
  "status" TEXT NOT NULL DEFAULT 'VIGENTE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DepreciationPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DepreciationPolicy_policyKey_key" ON "DepreciationPolicy"("policyKey");
CREATE INDEX "DepreciationPolicy_status_idx" ON "DepreciationPolicy"("status");
CREATE INDEX "DepreciationPolicy_accountingAccount_idx" ON "DepreciationPolicy"("accountingAccount");
CREATE INDEX "DepreciationPolicy_appliesFrom_idx" ON "DepreciationPolicy"("appliesFrom");
