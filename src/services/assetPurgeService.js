const { prisma } = require("../prisma");
const { forbidden } = require("../utils/httpError");
const {
  buildDependencyForceDeletePlan,
  buildEstablishmentForceDeletePlan,
  purgeByForceDeletePlan,
} = require("./adminForceDeleteService");

function requireCentral(user) {
  if (user.role.type !== "ADMIN_CENTRAL") {
    throw forbidden("Solo ADMIN_CENTRAL puede vaciar activos fijos");
  }
}

function toBool(value) {
  return value === true || value === "true" || value === "1";
}

async function purgeAssetsAndResetSequence(user, options = {}) {
  requireCentral(user);
  const purgeDependencies = toBool(options.purgeDependencies);
  const purgeEstablishments = toBool(options.purgeEstablishments);
  const forceDeleteStructure = toBool(options.forceDeleteStructure);

  const [
    assetCount,
    evidenceCount,
    movementCount,
    auditCount,
    importBatchCount,
    sequenceCount,
    dependencyCountBefore,
    establishmentCountBefore,
  ] =
    await Promise.all([
      prisma.asset.count(),
      prisma.assetEvidence.count(),
      prisma.movement.count(),
      prisma.assetAudit.count(),
      prisma.assetImportBatch.count(),
      prisma.assetSequence.count(),
      prisma.dependency.count(),
      prisma.establishment.count(),
    ]);

  await prisma.$transaction(async (tx) => {
    await tx.assetEvidence.deleteMany({});
    await tx.assetAudit.deleteMany({});
    await tx.movement.deleteMany({});
    await tx.asset.deleteMany({});
    await tx.assetImportBatch.deleteMany({});
    await tx.assetSequence.deleteMany({});

    await tx.$executeRawUnsafe('ALTER SEQUENCE "Asset_id_seq" RESTART WITH 1');
    await tx.$executeRawUnsafe('ALTER SEQUENCE "AssetEvidence_id_seq" RESTART WITH 1');
    await tx.$executeRawUnsafe('ALTER SEQUENCE "Movement_id_seq" RESTART WITH 1');
    await tx.$executeRawUnsafe('ALTER SEQUENCE "AssetAudit_id_seq" RESTART WITH 1');
    await tx.$executeRawUnsafe('ALTER SEQUENCE "AssetImportBatch_id_seq" RESTART WITH 1');
    await tx.$executeRawUnsafe('ALTER SEQUENCE "AssetSequence_id_seq" RESTART WITH 1');

    if (purgeDependencies || purgeEstablishments) {
      if (forceDeleteStructure) {
        if (purgeEstablishments) {
          const establishmentIds = await tx.establishment.findMany({ select: { id: true } });
          for (const item of establishmentIds) {
            const plan = await buildEstablishmentForceDeletePlan(tx, Number(item.id));
            await purgeByForceDeletePlan(tx, plan);
          }
        } else if (purgeDependencies) {
          const dependencyIds = await tx.dependency.findMany({ select: { id: true } });
          for (const item of dependencyIds) {
            const plan = await buildDependencyForceDeletePlan(tx, Number(item.id));
            await purgeByForceDeletePlan(tx, plan);
          }
        }
      } else {
        if (purgeDependencies) {
          await tx.dependency.deleteMany({
            where: { assets: { none: {} }, supportRequests: { none: {} } },
          });
        }
        if (purgeEstablishments) {
          await tx.establishment.deleteMany({
            where: {
              assets: { none: {} },
              dependencies: { none: {} },
              users: { none: {} },
              supportRequests: { none: {} },
            },
          });
        }
      }
    }
  });

  const [dependencyCountAfter, establishmentCountAfter] = await Promise.all([
    prisma.dependency.count(),
    prisma.establishment.count(),
  ]);
  const deletedDependencyCount = Math.max(0, dependencyCountBefore - dependencyCountAfter);
  const deletedEstablishmentCount = Math.max(0, establishmentCountBefore - establishmentCountAfter);

  return {
    purged: true,
    deletedCount: assetCount,
    deletedEvidenceCount: evidenceCount,
    deletedMovementCount: movementCount,
    deletedAuditCount: auditCount,
    deletedImportBatchCount: importBatchCount,
    deletedSequenceCount: sequenceCount,
    deletedDependencyCount,
    deletedEstablishmentCount,
    forceDeleteStructure,
    nextAssetId: 1,
    nextInternalCode: 1,
  };
}

module.exports = { purgeAssetsAndResetSequence };
