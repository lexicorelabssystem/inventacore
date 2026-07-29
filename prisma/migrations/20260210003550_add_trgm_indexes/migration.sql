-- Enable trigram extension for fast ILIKE search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram indexes for asset search fields
CREATE INDEX IF NOT EXISTS idx_asset_name_trgm ON "Asset" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_asset_brand_trgm ON "Asset" USING GIN ("brand" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_asset_model_trgm ON "Asset" USING GIN ("modelName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_asset_serial_trgm ON "Asset" USING GIN ("serialNumber" gin_trgm_ops);
