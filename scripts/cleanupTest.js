const { prisma } = require("../src/prisma");

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const institutions = await prisma.institution.findMany({
    where: { name: { contains: "TEST", mode: "insensitive" } },
    select: { id: true, name: true, isActive: true },
    orderBy: { id: "asc" },
  });

  const institutionIds = institutions.map((x) => x.id);
  if (!institutionIds.length) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun,
          message: "No hay instituciones que contengan TEST.",
        },
        null,
        2
      )
    );
    return;
  }

  const establishments = await prisma.establishment.findMany({
    where: { institutionId: { in: institutionIds } },
    select: { id: true, name: true, isActive: true },
  });
  const establishmentIds = establishments.map((x) => x.id);

  const activeInstitutionCount = institutions.filter((x) => x.isActive).length;
  const activeEstablishmentCount = establishments.filter((x) => x.isActive).length;

  const [activeDependencyCount, activeUserCount] = await Promise.all([
    establishmentIds.length
      ? prisma.dependency.count({
          where: { establishmentId: { in: establishmentIds }, isActive: true },
        })
      : 0,
    prisma.user.count({
      where: { institutionId: { in: institutionIds }, isActive: true },
    }),
  ]);

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun: true,
          institutionsMatched: institutions.length,
          activeInstitutionsToDeactivate: activeInstitutionCount,
          activeEstablishmentsToDeactivate: activeEstablishmentCount,
          activeDependenciesToDeactivate: activeDependencyCount,
          activeUsersToDeactivate: activeUserCount,
          sampleInstitutionNames: institutions.slice(0, 10).map((x) => x.name),
        },
        null,
        2
      )
    );
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const deactivatedDependencies = establishmentIds.length
      ? await tx.dependency.updateMany({
          where: { establishmentId: { in: establishmentIds }, isActive: true },
          data: { isActive: false },
        })
      : { count: 0 };

    const deactivatedEstablishments = await tx.establishment.updateMany({
      where: { institutionId: { in: institutionIds }, isActive: true },
      data: { isActive: false },
    });

    const deactivatedUsers = await tx.user.updateMany({
      where: { institutionId: { in: institutionIds }, isActive: true },
      data: { isActive: false },
    });

    const deactivatedInstitutions = await tx.institution.updateMany({
      where: { id: { in: institutionIds }, isActive: true },
      data: { isActive: false },
    });

    return {
      institutionsMatched: institutions.length,
      deactivatedInstitutions: deactivatedInstitutions.count,
      deactivatedEstablishments: deactivatedEstablishments.count,
      deactivatedDependencies: deactivatedDependencies.count,
      deactivatedUsers: deactivatedUsers.count,
    };
  });

  console.log(JSON.stringify({ ok: true, dryRun: false, ...result }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
