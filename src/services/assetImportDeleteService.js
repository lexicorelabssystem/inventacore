const { prisma } = require('../prisma');
const { badRequest, forbidden, notFound } = require('../utils/httpError');

function requireCentral(user) {
  if (user.role.type !== 'ADMIN_CENTRAL') throw forbidden('Solo ADMIN_CENTRAL puede borrar una importacion');
}

async function deleteAssetImportBatch(batchId, user) {
  requireCentral(user);
  const id = Number(batchId);
  const batch = await prisma.assetImportBatch.findUnique({ where: { id }, select: { id: true, filename: true, status: true } });
  if (!batch) throw notFound('Importacion no encontrada');
  if (batch.status === 'PROCESSING') throw badRequest('No se puede borrar una importacion que aun esta en proceso');

  const assetIds = (
    await prisma.asset.findMany({ where: { importBatchId: id }, select: { id: true } })
  ).map((asset) => asset.id);

  return prisma.$transaction(async (tx) => {
    let deletedEvidenceCount = 0;
    let deletedAuditCount = 0;
    let deletedMovementCount = 0;
    let deletedAssetCount = 0;
    if (assetIds.length) {
      deletedEvidenceCount = (await tx.assetEvidence.deleteMany({ where: { assetId: { in: assetIds } } })).count;
      deletedAuditCount = (await tx.assetAudit.deleteMany({ where: { assetId: { in: assetIds } } })).count;
      deletedMovementCount = (await tx.movement.deleteMany({ where: { assetId: { in: assetIds } } })).count;
      deletedAssetCount = (await tx.asset.deleteMany({ where: { id: { in: assetIds }, importBatchId: id } })).count;
    }
    await tx.assetImportBatch.delete({ where: { id } });
    return { deleted: true, batchId: id, filename: batch.filename, deletedAssetCount,
      deletedEvidenceCount, deletedAuditCount, deletedMovementCount };
  });
}

module.exports = { deleteAssetImportBatch };
