const { prisma } = require("../prisma");
const { badRequest, conflict, forbidden } = require("../utils/httpError");
const {
  calculateFiscalYearDepreciation,
  clampCurrency,
} = require("../utils/depreciationRunCalculator");

function clampTake(value, min = 1, max = 20, fallback = 5) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function toInt(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function isPrismaUniqueConstraintError(err) {
  if (!err) return false;
  if (err.code === "P2002") return true;
  if (err.name === "PrismaClientKnownRequestError" && err.message) {
    return String(err.message).includes("Unique constraint failed");
  }
  return false;
}

function assertCentralUser(user) {
  if (user?.role?.type !== "ADMIN_CENTRAL") {
    throw forbidden("Solo ADMIN_CENTRAL puede gestionar el cierre anual de depreciacion");
  }
  if (!user?.institutionId) {
    throw badRequest("Usuario sin institutionId");
  }
}

function getFiscalYearCloseAvailableFrom(fiscalYear) {
  return new Date(fiscalYear + 1, 0, 1, 0, 0, 0, 0);
}

function assertFiscalYearCloseWindow(fiscalYear, now = new Date()) {
  const availableFrom = getFiscalYearCloseAvailableFrom(fiscalYear);
  if (now.getTime() >= availableFrom.getTime()) return;

  throw conflict(
    `El cierre del año ${fiscalYear} solo se habilita desde el 01-01-${fiscalYear + 1}.`,
    "DEPRECIATION_RUN_NOT_AVAILABLE_YET",
    {
      fiscalYear,
      availableFrom: availableFrom.toISOString(),
    }
  );
}

function mapRun(run) {
  return {
    id: run.id,
    institutionId: run.institutionId,
    fiscalYear: run.fiscalYear,
    closingDate: run.closingDate,
    closedAt: run.closedAt,
    closedById: run.closedById,
    closedBy: run.closedBy
      ? {
          id: run.closedBy.id,
          name: run.closedBy.name,
          email: run.closedBy.email,
        }
      : null,
    totalAssets: run.totalAssets,
    totalAnnualDepreciation: clampCurrency(run.totalAnnualDepreciation),
    totalClosingBookValue: clampCurrency(run.totalClosingBookValue),
    itemsCount: run._count?.items || run.itemsCount || 0,
  };
}

async function listDepreciationRuns(query, user) {
  assertCentralUser(user);
  const fiscalYear = toInt(query?.fiscalYear);
  const take = clampTake(query?.take);
  const skip = Math.max(toInt(query?.skip) || 0, 0);

  const where = {
    institutionId: user.institutionId,
    ...(fiscalYear ? { fiscalYear } : {}),
  };

  const items = await prisma.depreciationRun.findMany({
    where,
    orderBy: [{ fiscalYear: "desc" }, { closedAt: "desc" }],
    take,
    skip,
    include: {
      closedBy: { select: { id: true, name: true, email: true } },
      _count: { select: { items: true } },
    },
  });
  const total = await prisma.depreciationRun.count({ where });

  const normalizedItems = items.map(mapRun);
  return {
    total,
    skip,
    take,
    items: normalizedItems,
    latest: normalizedItems[0] || null,
  };
}

async function closeAnnualDepreciationRun(input, user) {
  assertCentralUser(user);

  const fiscalYear = toInt(input?.fiscalYear);
  if (!fiscalYear || fiscalYear < 2000 || fiscalYear > 2200) {
    throw badRequest("Año inválido");
  }
  assertFiscalYearCloseWindow(fiscalYear);

  const closingDate = new Date(Date.UTC(fiscalYear, 11, 31, 23, 59, 59, 999));

  const [activePolicies, assets] = await Promise.all([
    prisma.depreciationPolicy.findMany({
      where: { status: "VIGENTE" },
      orderBy: [{ accountingAccount: "asc" }, { appliesFrom: "desc" }],
      select: {
        accountingAccount: true,
        category: true,
        subcategory: true,
        usefulLifeYears: true,
        appliesFrom: true,
        status: true,
      },
    }),
    prisma.asset.findMany({
      where: {
        establishment: { institutionId: user.institutionId },
        isDeleted: false,
        acquisitionDate: { lte: closingDate },
      },
      orderBy: [{ internalCode: "asc" }],
      include: {
        assetType: { select: { id: true, name: true } },
        establishment: { select: { id: true, name: true } },
        dependency: { select: { id: true, name: true } },
        catalogItem: { select: { id: true, category: true, subcategory: true } },
      },
    }),
  ]);

  if (!assets.length) {
    throw badRequest(`No hay activos para cerrar depreciación en el año ${fiscalYear}`);
  }

  const items = [];
  let totalAnnualDepreciation = 0;
  let totalClosingBookValue = 0;

  for (const asset of assets) {
    const item = calculateFiscalYearDepreciation(asset, activePolicies, fiscalYear);
    totalAnnualDepreciation = clampCurrency(totalAnnualDepreciation + item.annualDepreciation);
    totalClosingBookValue = clampCurrency(totalClosingBookValue + item.closingBookValue);
    items.push({
      assetId: asset.id,
      assetInternalCode: asset.internalCode,
      assetName: asset.name,
      establishmentId: asset.establishmentId,
      establishmentName: asset.establishment?.name || null,
      dependencyId: asset.dependencyId,
      dependencyName: asset.dependency?.name || null,
      acquisitionValueSnapshot: clampCurrency(item.acquisitionValue),
      depreciationStartDateSnapshot: item.depreciationStartDate,
      usefulLifeYearsSnapshot: item.usefulLifeYears,
      depreciationAnnualValueSnapshot: clampCurrency(item.depreciationAnnualValue),
      residualAmountSnapshot: clampCurrency(item.residualAmount),
      openingBookValue: clampCurrency(item.openingBookValue),
      annualDepreciation: clampCurrency(item.annualDepreciation),
      closingBookValue: clampCurrency(item.closingBookValue),
      accumulatedDepreciation: clampCurrency(item.accumulatedDepreciation),
      periodStart: item.periodStart,
      periodEnd: item.periodEnd,
    });
  }

  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.depreciationRun.findUnique({
        where: {
          institutionId_fiscalYear: {
            institutionId: user.institutionId,
            fiscalYear,
          },
        },
        select: { id: true },
      });
      if (existing) {
        throw conflict(`Ya existe un cierre de depreciación para el año ${fiscalYear}`);
      }

      try {
        const run = await tx.depreciationRun.create({
          data: {
            institutionId: user.institutionId,
            fiscalYear,
            closingDate,
            closedById: user.id,
            totalAssets: items.length,
            totalAnnualDepreciation,
            totalClosingBookValue,
          },
          include: {
            closedBy: { select: { id: true, name: true, email: true } },
          },
        });

        await tx.depreciationRunItem.createMany({
          data: items.map((item) => ({
            ...item,
            depreciationRunId: run.id,
          })),
        });

        return mapRun({
          ...run,
          _count: { items: items.length },
        });
      } catch (err) {
        if (isPrismaUniqueConstraintError(err)) {
          throw conflict(`Ya existe un cierre de depreciación para el año ${fiscalYear}`);
        }
        throw err;
      }
    },
    { timeout: 30000, maxWait: 5000 }
  );
}

module.exports = {
  listDepreciationRuns,
  closeAnnualDepreciationRun,
};
