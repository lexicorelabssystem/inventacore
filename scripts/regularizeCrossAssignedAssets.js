require('../src/config/loadEnv').loadEnv();
const { prisma } = require('../src/prisma');
const { snapshotAsset } = require('../src/services/assetAuditService');

const EXECUTE = process.argv.includes('--execute');
const CONFIRM_TEXT = 'REGULARIZAR_ACTIVOS_CRUZADOS';
const confirmInline = process.argv.find((arg) => arg.startsWith('--confirm='));
const confirmArg = confirmInline ? confirmInline.slice('--confirm='.length) : '';

const RULES = [
  { responsibleRegex: /FRANCISCO\s+ALVAREZ\s+SOTO/i, targetEstName: 'UEFAA VALLE' },
  { responsibleRegex: /MARIANA\s+RIVERA\s+MARQUEZ/i, targetEstName: 'RESIDENCIA FAMILIAR PEHUENCHE' },
  { responsibleRegex: /CECILIA\s+GAJARDO\s+ORELLANA/i, targetEstName: 'RESIDENCIA FAMILIAR ALAMEDA' },
];

function norm(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function resolveFallbackDependency(targetEstName, fromDependencyName) {
  const est = norm(targetEstName);
  const dep = norm(fromDependencyName);

  if (est.includes('PEHUENCHE')) {
    if (dep.startsWith('PATIO')) return 'PATIO';
  }
  if (est.includes('ALAMEDA')) {
    if (dep.includes('BODEGA')) return 'BODEGA';
  }

  return null;
}

async function buildPlan() {
  const establishments = await prisma.establishment.findMany({
    select: { id: true, name: true },
  });
  const estByNormName = new Map(establishments.map((e) => [norm(e.name), e]));

  const dependencies = await prisma.dependency.findMany({
    where: { isActive: true },
    select: { id: true, name: true, establishmentId: true },
  });

  const depByEstAndName = new Map();
  for (const dep of dependencies) {
    depByEstAndName.set(`${dep.establishmentId}::${norm(dep.name)}`, dep);
  }

  const assets = await prisma.asset.findMany({
    where: { isDeleted: false },
    select: {
      id: true,
      internalCode: true,
      name: true,
      responsibleName: true,
      establishmentId: true,
      dependencyId: true,
      assetTypeId: true,
      assetStateId: true,
      quantity: true,
      brand: true,
      modelName: true,
      serialNumber: true,
      accountingAccount: true,
      analyticCode: true,
      responsibleRut: true,
      responsibleRole: true,
      costCenter: true,
      acquisitionValue: true,
      acquisitionDate: true,
      depreciationStartDate: true,
      usefulLifeYears: true,
      depreciationAnnualValue: true,
      establishment: { select: { id: true, name: true } },
      dependency: { select: { id: true, name: true } },
    },
  });

  const plan = [];
  const unresolved = [];

  for (const asset of assets) {
    const rule = RULES.find((r) => r.responsibleRegex.test(String(asset.responsibleName || '')));
    if (!rule) continue;

    const targetEst = estByNormName.get(norm(rule.targetEstName));
    if (!targetEst) continue;

    if (asset.establishmentId === targetEst.id) continue;

    const fromDepName = String(asset?.dependency?.name || '').trim();
    const exactDep = depByEstAndName.get(`${targetEst.id}::${norm(fromDepName)}`);

    let targetDep = exactDep || null;
    if (!targetDep) {
      const fallbackName = resolveFallbackDependency(targetEst.name, fromDepName);
      if (fallbackName) {
        targetDep = depByEstAndName.get(`${targetEst.id}::${norm(fallbackName)}`) || null;
      }
    }

    if (!targetDep) {
      unresolved.push({
        id: asset.id,
        code: asset.internalCode,
        name: asset.name,
        responsibleName: asset.responsibleName,
        fromEst: asset?.establishment?.name || '',
        fromDep: fromDepName,
        targetEst: targetEst.name,
      });
      continue;
    }

    plan.push({
      id: asset.id,
      internalCode: asset.internalCode,
      name: asset.name,
      responsibleName: asset.responsibleName,
      fromEstablishmentId: asset.establishmentId,
      toEstablishmentId: targetEst.id,
      fromDependencyId: asset.dependencyId,
      toDependencyId: targetDep.id,
      fromEstablishmentName: asset?.establishment?.name || '',
      toEstablishmentName: targetEst.name,
      fromDependencyName: fromDepName,
      toDependencyName: targetDep.name,
      snapshot: snapshotAsset(asset),
    });
  }

  return { plan, unresolved };
}

async function main() {
  const actor = await prisma.user.findFirst({
    where: { role: { type: 'ADMIN_CENTRAL' } },
    select: { id: true, name: true },
  });
  if (!actor) throw new Error('No existe usuario ADMIN_CENTRAL para registrar auditoria.');

  const { plan, unresolved } = await buildPlan();

  const summary = plan.reduce((acc, row) => {
    const k = `${row.fromEstablishmentName} -> ${row.toEstablishmentName}`;
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  console.log('');
  console.log('=== REGULARIZACION ACTIVOS CRUZADOS ===');
  console.log('Actor auditoria:', actor.id, actor.name);
  console.log('Total a mover:', plan.length);
  console.log('Sin resolver (sin sector destino):', unresolved.length);
  console.log('Resumen por ruta:', JSON.stringify(summary, null, 2));
  console.log('Muestra (primeros 25):');
  console.table(
    plan.slice(0, 25).map((r) => ({
      id: r.id,
      code: r.internalCode,
      nombre: r.name,
      responsable: r.responsibleName,
      de_est: r.fromEstablishmentName,
      de_sector: r.fromDependencyName,
      a_est: r.toEstablishmentName,
      a_sector: r.toDependencyName,
    }))
  );

  if (unresolved.length) {
    console.log('Muestra sin resolver (primeros 20):');
    console.table(unresolved.slice(0, 20));
  }

  if (!EXECUTE) {
    console.log('\n[DRY RUN] No se aplicaron cambios.');
    console.log(`Para aplicar: node scripts/regularizeCrossAssignedAssets.js --execute --confirm=${CONFIRM_TEXT}`);
    return;
  }

  if (String(confirmArg).trim() !== CONFIRM_TEXT) {
    throw new Error(`Confirmacion invalida. Usa --confirm=${CONFIRM_TEXT}`);
  }

  if (unresolved.length) {
    throw new Error('Hay activos sin sector destino resuelto. No se aplicaron cambios.');
  }

  await prisma.$transaction(async (tx) => {
    for (const row of plan) {
      const moved = await tx.asset.update({
        where: { id: row.id },
        data: {
          establishmentId: row.toEstablishmentId,
          dependencyId: row.toDependencyId,
        },
      });

      const movement = await tx.movement.create({
        data: {
          type: 'TRANSFER',
          reasonCode: 'REGULARIZACION_DATOS',
          reason: 'REGULARIZACION_DATOS',
          assetId: row.id,
          fromDependencyId: row.fromDependencyId,
          toDependencyId: row.toDependencyId,
          userId: actor.id,
        },
      });

      await tx.assetAudit.create({
        data: {
          action: 'RELOCATE',
          assetId: row.id,
          userId: actor.id,
          before: row.snapshot,
          after: {
            ...snapshotAsset(moved),
            _meta: {
              kind: 'DATA_REGULARIZATION',
              movementId: movement.id,
              note: 'Regularizacion automatica por responsable y establecimiento',
            },
          },
        },
      });
    }
  });

  console.log('\n[OK] Regularizacion aplicada. Activos movidos:', plan.length);
}

main()
  .catch((e) => {
    console.error('[ERROR]', e?.message || e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
