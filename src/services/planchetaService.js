const { prisma } = require("../prisma");
const { badRequest, forbidden } = require("../utils/httpError");
const { buildScopedAssetWhere } = require("../utils/assetScopeWhere");

const PLANCHETA_ERROR_CODES = {
  INVALID_DATE_FORMAT: "PLANCHETA_INVALID_DATE_FORMAT",
  INVALID_DATE_RANGE: "PLANCHETA_INVALID_DATE_RANGE",
};

function parseDateStart(dateText) {
  if (!dateText) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    throw badRequest(
      "fromDate invalida. Formato esperado: YYYY-MM-DD",
      PLANCHETA_ERROR_CODES.INVALID_DATE_FORMAT,
      { field: "fromDate", expectedFormat: "YYYY-MM-DD" }
    );
  }
  const parsed = new Date(`${dateText}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw badRequest(
      "fromDate invalida. Formato esperado: YYYY-MM-DD",
      PLANCHETA_ERROR_CODES.INVALID_DATE_FORMAT,
      { field: "fromDate", expectedFormat: "YYYY-MM-DD" }
    );
  }
  return parsed;
}

function parseDateEnd(dateText) {
  if (!dateText) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    throw badRequest(
      "toDate invalida. Formato esperado: YYYY-MM-DD",
      PLANCHETA_ERROR_CODES.INVALID_DATE_FORMAT,
      { field: "toDate", expectedFormat: "YYYY-MM-DD" }
    );
  }
  const parsed = new Date(`${dateText}T23:59:59.999Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw badRequest(
      "toDate invalida. Formato esperado: YYYY-MM-DD",
      PLANCHETA_ERROR_CODES.INVALID_DATE_FORMAT,
      { field: "toDate", expectedFormat: "YYYY-MM-DD" }
    );
  }
  return parsed;
}

async function getPlanchetaData(
  {
    dependencyId,
    sectorId,
    establishmentId,
    includeHistory,
    fromDate,
    toDate,
    responsibleFilterName,
    responsibleName,
  },
  user
) {
  const effectiveDependencyId = dependencyId || sectorId;
  const { scopeWhere } = await resolvePlanchetaScope(
    { dependencyId: effectiveDependencyId, sectorId, establishmentId, fromDate, toDate },
    user
  );

  const normalizedResponsibleFilter = String(responsibleFilterName || "").trim();
  const normalizedResponsibleName = String(responsibleName || "").trim();
  const effectiveResponsibleFilter =
    normalizedResponsibleFilter ||
    (normalizedResponsibleName &&
    !["encargado de sector", "sin asignar"].includes(normalizedResponsibleName.toLowerCase())
      ? normalizedResponsibleName
      : "");
  const responsibleWhere = effectiveResponsibleFilter
    ? {
        OR: [
          {
            responsibleName: {
              equals: effectiveResponsibleFilter,
              mode: "insensitive",
            },
          },
          { responsibleName: null },
          { responsibleName: "" },
        ],
      }
    : {};

  const where = {
    ...buildScopedAssetWhere({
      establishmentId: scopeWhere.establishmentId,
      dependencyId: scopeWhere.dependencyId,
      // Plancheta operativa: el rango de fechas es referencial para caratula,
      // no debe recortar el inventario vigente del establecimiento/sector.
      isDeleted: false,
    }),
    // Regla operativa: no mostrar activos dados de baja en planchetas.
    assetState: {
      name: {
        not: "BAJA",
      },
    },
    AND: [
      {
        NOT: {
          internalCode: {
            in: [692],
          },
        },
      },
      {
        NOT: {
          name: {
            startsWith: "Activo importado fila ",
          },
        },
      },
      {
        // Regla operativa: no incluir registros de ropa sucia en planchetas.
        NOT: {
          name: {
            contains: "ROPA SUCIA",
            mode: "insensitive",
          },
        },
      },
    ],
    ...responsibleWhere,
  };

  const assets = await prisma.asset.findMany({
    where,
    orderBy: { internalCode: "asc" },
    include: {
      assetState: true,
      assetType: true,
      catalogItem: {
        select: {
          id: true,
          name: true,
          category: true,
          subcategory: true,
          brand: true,
          modelName: true,
          description: true,
        },
      },
      dependency: true,
      establishment: { include: { institution: true } },
      ...(includeHistory
        ? {
            movements: {
              orderBy: { createdAt: "desc" },
              take: 5,
              select: {
                id: true,
                type: true,
                reasonCode: true,
                reason: true,
                createdAt: true,
                user: { select: { id: true, name: true } },
                fromDependency: { select: { id: true, name: true } },
                toDependency: { select: { id: true, name: true } },
              },
            },
          }
        : {}),
    },
  });

  const assetsWithResponsible = !effectiveResponsibleFilter
    ? assets
    : assets.map((asset) => {
        const normalized = String(asset?.responsibleName || "").trim();
        if (normalized) return asset;
        return { ...asset, responsibleName: effectiveResponsibleFilter };
      });

  return assetsWithResponsible;
}

function buildPlanchetaEligibleAssetWhere(extraWhere = {}) {
  return {
    ...extraWhere,
    isDeleted: false,
    assetState: {
      name: {
        not: "BAJA",
      },
    },
    AND: [
      {
        NOT: {
          internalCode: {
            in: [692],
          },
        },
      },
      {
        NOT: {
          name: {
            startsWith: "Activo importado fila ",
          },
        },
      },
      {
        NOT: {
          name: {
            contains: "ROPA SUCIA",
            mode: "insensitive",
          },
        },
      },
    ],
  };
}

async function getPlanchetaVisibleCodeStart(filters, user, assets) {
  const sortedAssets = Array.isArray(assets)
    ? [...assets].sort((a, b) => Number(a?.internalCode || 0) - Number(b?.internalCode || 0))
    : [];
  const firstInternalCode = Number(sortedAssets[0]?.internalCode);
  if (!Number.isFinite(firstInternalCode) || firstInternalCode <= 1) return 1;

  const userScope =
    user?.role?.type === "ADMIN_ESTABLISHMENT" && user?.establishmentId
      ? { establishmentId: Number(user.establishmentId) }
      : {};

  const priorVisibleCount = await prisma.asset.count({
    where: buildPlanchetaEligibleAssetWhere({
      ...userScope,
      internalCode: {
        lt: firstInternalCode,
      },
    }),
  });

  return priorVisibleCount + 1;
}

async function resolvePlanchetaScope(
  { dependencyId, sectorId, establishmentId, fromDate, toDate },
  user
) {
  const effectiveDependencyId = dependencyId || sectorId;
  if (!establishmentId) {
    throw badRequest("Debe indicar establishmentId (residencia) para generar plancheta");
  }

  const fromDateParsed = parseDateStart(fromDate);
  const toDateParsed = parseDateEnd(toDate);
  if (fromDateParsed && toDateParsed && fromDateParsed > toDateParsed) {
    throw badRequest(
      "Rango de fechas invalido: fromDate no puede ser mayor que toDate",
      PLANCHETA_ERROR_CODES.INVALID_DATE_RANGE,
      { fromDate, toDate }
    );
  }

  const normalizedEstablishmentId = Number(establishmentId);

  if (effectiveDependencyId) {
    const dep = await prisma.dependency.findUnique({
      where: { id: effectiveDependencyId },
      select: { establishmentId: true },
    });

    if (!dep) {
      throw badRequest("Sector/dependency no existe");
    }
    if (dep.establishmentId !== normalizedEstablishmentId) {
      throw forbidden("El sector seleccionado no pertenece al establecimiento indicado");
    }
  }

  if (user.role.type === "ADMIN_ESTABLISHMENT") {
    if (normalizedEstablishmentId !== user.establishmentId) {
      throw forbidden("No autorizado para este establecimiento");
    }
  }

  return {
    scopeWhere: {
      ...(effectiveDependencyId ? { dependencyId: effectiveDependencyId } : {}),
      establishmentId: normalizedEstablishmentId,
    },
  };
}

function buildPlanchetaRecommendations(activeAssets, deletedAssets) {
  const activeItems = Array.isArray(activeAssets) ? activeAssets : [];
  const deletedItems = Array.isArray(deletedAssets) ? deletedAssets : [];
  const totalUnits = activeItems.reduce(
    (acc, item) => acc + Math.max(Number(item?.quantity) || 0, 1),
    0
  );
  const deletedMonthUnits = deletedItems.reduce(
    (acc, item) => acc + Math.max(Number(item?.quantity) || 0, 1),
    0
  );
  const withoutResponsible = activeItems.filter(
    (item) => !String(item?.responsibleName || "").trim()
  ).length;
  const reviewStates = activeItems.filter((item) => {
    const state = String(item?.assetState?.name || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
    return state.includes("MALO") || state.includes("CRIT");
  }).length;
  const healthyStates = activeItems.filter((item) => {
    const state = String(item?.assetState?.name || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
    return state.includes("BUENO");
  }).length;

  const change = [];
  const keep = [];

  if (deletedMonthUnits >= Math.max(3, Math.ceil(totalUnits * 0.1))) {
    change.push(
      "Aumentaron las bajas del ultimo mes. Conviene revisar reposicion, mantencion y causas de salida."
    );
  } else if (deletedMonthUnits > 0) {
    change.push(
      "Hubo bajas recientes. Revisa si corresponde reemplazar equipos o ajustar la asignacion de activos."
    );
  }
  if (reviewStates > 0) {
    change.push(
      `Hay ${reviewStates} activos en estado malo/critico. Prioriza reparacion, baja o reemplazo.`
    );
  }
  if (withoutResponsible > 0) {
    change.push(
      `Hay ${withoutResponsible} activos sin responsable. Regulariza la custodia y firma de sector.`
    );
  }
  if (!change.length) {
    change.push("No se detectan cambios urgentes. Mantener monitoreo semanal del inventario.");
  }

  if (healthyStates >= Math.max(1, Math.ceil(activeItems.length * 0.6))) {
    keep.push("La mayoria del inventario sigue en buen estado. Mantener el plan actual de uso y control.");
  }
  if (!deletedMonthUnits) {
    keep.push("No hay bajas registradas en los ultimos 30 dias. Mantener el esquema actual de resguardo.");
  }
  if (!withoutResponsible) {
    keep.push("La custodia esta completa en la muestra actual. Mantener la asignacion formal vigente.");
  }
  if (!keep.length) {
    keep.push("Mantener seguimiento de responsables, estados y bajas para validar estabilidad operacional.");
  }

  return { change, keep, withoutResponsible, reviewStates, healthyStates, totalUnits };
}

async function getPlanchetaInsights(filters, user, activeAssets = []) {
  const { scopeWhere } = await resolvePlanchetaScope(filters, user);
  const includeHistory = Boolean(filters?.includeHistory);
  const responsibleFilterName = String(filters?.responsibleFilterName || "").trim();
  const responsibleName = String(filters?.responsibleName || "").trim();
  const effectiveResponsibleFilter =
    responsibleFilterName ||
    (responsibleName &&
    !["encargado de sector", "sin asignar"].includes(responsibleName.toLowerCase())
      ? responsibleName
      : "");
  const responsibleWhere = effectiveResponsibleFilter
    ? {
        OR: [
          {
            responsibleName: {
              equals: effectiveResponsibleFilter,
              mode: "insensitive",
            },
          },
          { responsibleName: null },
          { responsibleName: "" },
        ],
      }
    : {};
  const now = new Date();
  const weeklyStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthlyStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const deletedAssets = includeHistory
    ? await prisma.asset.findMany({
        where: {
          ...scopeWhere,
          ...responsibleWhere,
          isDeleted: true,
          deletedAt: { gte: monthlyStart },
        },
        orderBy: { deletedAt: "desc" },
        select: {
          id: true,
          name: true,
          internalCode: true,
          quantity: true,
          deletedAt: true,
          responsibleName: true,
          dependency: { select: { id: true, name: true } },
          catalogItem: { select: { category: true } },
          assetState: { select: { name: true } },
        },
      })
    : [];
  const deletedScopedAssets = includeHistory
    ? await prisma.asset.findMany({
        where: {
          ...scopeWhere,
          ...responsibleWhere,
          isDeleted: true,
        },
        select: {
          id: true,
          quantity: true,
          assetState: { select: { name: true } },
        },
      })
    : [];

  const monthlyItems = deletedAssets;
  const weeklyItems = deletedAssets.filter((item) => item.deletedAt && item.deletedAt >= weeklyStart);
  const toUnits = (items) =>
    items.reduce((acc, item) => acc + Math.max(Number(item?.quantity) || 0, 1), 0);

  const monthlyByCategory = Array.from(
    monthlyItems.reduce((map, item) => {
      const key =
        String(item?.catalogItem?.category || "Sin categoria").trim() || "Sin categoria";
      map.set(key, (map.get(key) || 0) + Math.max(Number(item?.quantity) || 0, 1));
      return map;
    }, new Map())
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }));

  const recommendations = buildPlanchetaRecommendations(activeAssets, monthlyItems);
  const stateOverviewSource = includeHistory
    ? [...(Array.isArray(activeAssets) ? activeAssets : []), ...deletedScopedAssets]
    : Array.isArray(activeAssets)
      ? activeAssets
      : [];
  const stateOverview = Array.from(
    stateOverviewSource.reduce((map, item) => {
      const stateName = String(item?.assetState?.name || "Sin estado").trim() || "Sin estado";
      const units = Math.max(Number(item?.quantity) || 0, 1);
      map.set(stateName, (map.get(stateName) || 0) + units);
      return map;
    }, new Map())
  )
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));

  return {
    weekly: {
      count: weeklyItems.length,
      units: toUnits(weeklyItems),
      items: weeklyItems.slice(0, 5).map((item) => ({
        id: item.id,
        internalCode: item.internalCode,
        name: item.name,
        quantity: Math.max(Number(item?.quantity) || 0, 1),
        deletedAt: item.deletedAt,
        dependencyName: item?.dependency?.name || "Sin sector",
      })),
    },
    monthly: {
      count: monthlyItems.length,
      units: toUnits(monthlyItems),
      items: monthlyItems.slice(0, 8).map((item) => ({
        id: item.id,
        internalCode: item.internalCode,
        name: item.name,
        quantity: Math.max(Number(item?.quantity) || 0, 1),
        deletedAt: item.deletedAt,
        dependencyName: item?.dependency?.name || "Sin sector",
      })),
      byCategory: monthlyByCategory,
    },
    stateOverview,
    recommendations,
  };
}

module.exports = {
  getPlanchetaData,
  getPlanchetaInsights,
  getPlanchetaVisibleCodeStart,
};

