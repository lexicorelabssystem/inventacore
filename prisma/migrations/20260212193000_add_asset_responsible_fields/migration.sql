-- Add quantity and responsible metadata to assets
ALTER TABLE "Asset"
ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "responsibleName" TEXT,
ADD COLUMN "responsibleRut" TEXT,
ADD COLUMN "responsibleRole" TEXT,
ADD COLUMN "costCenter" TEXT;
