const { prisma } = require("../src/prisma");

async function purgeInactiveDependencies() {
  const deps = await prisma.dependency.findMany({
    where: { isActive: false },
    select: { id: true },
  });
  let deleted = 0;
  let blocked = 0;

  for (const dep of deps) {
    const [assetCount, fromMovements, toMovements] = await Promise.all([
      prisma.asset.count({ where: { dependencyId: dep.id } }),
      prisma.movement.count({ where: { fromDependencyId: dep.id } }),
      prisma.movement.count({ where: { toDependencyId: dep.id } }),
    ]);
    if (assetCount > 0 || fromMovements > 0 || toMovements > 0) {
      blocked += 1;
      continue;
    }
    await prisma.dependency.delete({ where: { id: dep.id } });
    deleted += 1;
  }
  return { deleted, blocked };
}

async function purgeInactiveEstablishments() {
  const items = await prisma.establishment.findMany({
    where: { isActive: false },
    select: { id: true, institutionId: true },
  });
  let deleted = 0;
  let blocked = 0;

  for (const item of items) {
    const [depCount, assetCount, userCount] = await Promise.all([
      prisma.dependency.count({ where: { establishmentId: item.id } }),
      prisma.asset.count({ where: { establishmentId: item.id } }),
      prisma.user.count({ where: { establishmentId: item.id } }),
    ]);
    if (depCount > 0 || assetCount > 0 || userCount > 0) {
      blocked += 1;
      continue;
    }
    await prisma.establishment.delete({ where: { id: item.id } });
    deleted += 1;
  }

  return { deleted, blocked };
}

async function purgeInactiveInstitutions() {
  const items = await prisma.institution.findMany({
    where: { isActive: false },
    select: { id: true },
  });
  let deleted = 0;
  let blocked = 0;

  for (const item of items) {
    const [estCount, userCount] = await Promise.all([
      prisma.establishment.count({ where: { institutionId: item.id } }),
      prisma.user.count({ where: { institutionId: item.id } }),
    ]);
    if (estCount > 0 || userCount > 0) {
      blocked += 1;
      continue;
    }
    await prisma.assetSequence.deleteMany({ where: { institutionId: item.id } });
    await prisma.institution.delete({ where: { id: item.id } });
    deleted += 1;
  }

  return { deleted, blocked };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) {
    const [inactiveDependencies, inactiveEstablishments, inactiveInstitutions] =
      await Promise.all([
        prisma.dependency.count({ where: { isActive: false } }),
        prisma.establishment.count({ where: { isActive: false } }),
        prisma.institution.count({ where: { isActive: false } }),
      ]);
    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun: true,
          inactiveDependencies,
          inactiveEstablishments,
          inactiveInstitutions,
        },
        null,
        2
      )
    );
    return;
  }

  let depDeletedTotal = 0;
  let depBlockedTotal = 0;
  let estDeletedTotal = 0;
  let estBlockedTotal = 0;
  let instDeletedTotal = 0;
  let instBlockedTotal = 0;

  for (let i = 0; i < 5; i += 1) {
    const dep = await purgeInactiveDependencies();
    const est = await purgeInactiveEstablishments();
    const inst = await purgeInactiveInstitutions();

    depDeletedTotal += dep.deleted;
    depBlockedTotal = dep.blocked;
    estDeletedTotal += est.deleted;
    estBlockedTotal = est.blocked;
    instDeletedTotal += inst.deleted;
    instBlockedTotal = inst.blocked;

    if (dep.deleted === 0 && est.deleted === 0 && inst.deleted === 0) break;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        deleted: {
          dependencies: depDeletedTotal,
          establishments: estDeletedTotal,
          institutions: instDeletedTotal,
        },
        blocked: {
          dependencies: depBlockedTotal,
          establishments: estBlockedTotal,
          institutions: instBlockedTotal,
        },
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
