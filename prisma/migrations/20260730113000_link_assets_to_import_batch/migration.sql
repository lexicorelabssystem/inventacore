ALTER TABLE Asset ADD COLUMN importBatchId INTEGER;
CREATE INDEX Asset_importBatchId_idx ON Asset(importBatchId);
ALTER TABLE Asset
ADD CONSTRAINT Asset_importBatchId_fkey
FOREIGN KEY (importBatchId) REFERENCES AssetImportBatch(id)
ON DELETE SET NULL ON UPDATE CASCADE;

-- Recover legacy links only when an asset matches exactly one completed import.
WITH candidates AS (
  SELECT a.id AS asset_id, b.id AS batch_id,
    COUNT(*) OVER (PARTITION BY a.id) AS match_count
  FROM Asset a
  JOIN Movement m ON m.assetId = a.id AND m.type = 'INVENTORY_CHECK'
  JOIN AssetImportBatch b
    ON b.userId = m.userId
   AND b.status = 'COMPLETED'
   AND a.createdAt >= b.createdAt
   AND a.createdAt <= COALESCE(b.completedAt, b.createdAt)
  WHERE a.importBatchId IS NULL
    -- Manual creations always write an AssetAudit; imports do not. Excluding any
    -- audited asset prevents a concurrent manual creation from being backfilled.
    AND NOT EXISTS (SELECT 1 FROM AssetAudit aa WHERE aa.assetId = a.id)
)
UPDATE Asset a SET importBatchId = c.batch_id
FROM candidates c
WHERE a.id = c.asset_id AND c.match_count = 1;
