const { prisma } = require("../prisma");
const { forbidden, badRequest } = require("../utils/httpError");

function clampTake(take) {
  return Math.min(Math.max(take || 20, 1), 100);
}

function clampSkip(skip) {
  return Math.max(skip || 0, 0);
}

function textFilter(q) {
  if (!q) return undefined;
  return { name: { contains: q, mode: "insensitive" } };
}

async function listInstitutions(user, query) {
  const take = clampTake(query.take);
  const skip = clampSkip(query.skip);
  const nameFilter = textFilter(query.q);
  const includeInactive =
    query.includeInactive === true ||
    query.includeInactive === "true" ||
    query.includeInactive === "1";

  if (user.role.type === "ADMIN_CENTRAL") {
    const where = { ...(includeInactive ? {} : { isActive: true }), ...(nameFilter || {}) };
    const items = await prisma.institution.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take,
    });
    const total = await prisma.institution.count({ where });
    return { total, skip, take, items };
  }

  if (!user.institutionId) {
    throw badRequest("Usuario sin institutionId");
  }

  const where = {
    id: user.institutionId,
    ...(includeInactive ? {} : { isActive: true }),
    ...(nameFilter || {}),
  };
  const items = await prisma.institution.findMany({
    where,
    orderBy: { name: "asc" },
    skip,
    take,
  });
  const total = await prisma.institution.count({ where });
  return { total, skip, take, items };
}

async function listEstablishments(user, query) {
  const take = clampTake(query.take);
  const skip = clampSkip(query.skip);
  const nameFilter = textFilter(query.q);
  let institutionId =
    query.institutionId !== undefined && query.institutionId !== ""
      ? Number(query.institutionId)
      : undefined;
  if (Number.isNaN(institutionId)) institutionId = undefined;
  const includeInactive =
    query.includeInactive === true ||
    query.includeInactive === "true" ||
    query.includeInactive === "1";
  const roleType = user?.role?.type || user?.roleType || user?.role;

  if (roleType === "ADMIN_CENTRAL") {
    const where = {
      ...(includeInactive ? {} : { isActive: true }),
      ...(institutionId ? { institutionId } : {}),
      ...(nameFilter || {}),
    };
    const items = await prisma.establishment.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take,
    });
    const total = await prisma.establishment.count({ where });
    return { total, skip, take, items };
  }

  if (roleType === "ADMIN_ESTABLISHMENT") {
    if (!user.establishmentId) throw badRequest("Usuario sin establishmentId");
    const where = {
      id: user.establishmentId,
      ...(includeInactive ? {} : { isActive: true }),
      ...(nameFilter || {}),
    };
    const items = await prisma.establishment.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take,
    });
    const total = await prisma.establishment.count({ where });
    return { total, skip, take, items };
  }

  if (roleType === "VIEWER") {
    if (!user.institutionId) throw badRequest("Usuario sin institutionId");
    const where = {
      ...(includeInactive ? {} : { isActive: true }),
      institutionId: user.institutionId,
      ...(nameFilter || {}),
    };
    const items = await prisma.establishment.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take,
    });
    const total = await prisma.establishment.count({ where });
    return { total, skip, take, items };
  }

  throw forbidden("Rol no permitido");
}

async function listDependencies(user, query) {
  const take = clampTake(query.take);
  const skip = clampSkip(query.skip);
  const nameFilter = textFilter(query.q);
  let establishmentId =
    query.establishmentId !== undefined && query.establishmentId !== ""
      ? Number(query.establishmentId)
      : undefined;
  if (Number.isNaN(establishmentId)) establishmentId = undefined;
  const includeInactive =
    query.includeInactive === true ||
    query.includeInactive === "true" ||
    query.includeInactive === "1";

  if (user.role.type === "ADMIN_CENTRAL") {
    const where = {
      ...(includeInactive ? {} : { isActive: true }),
      ...(establishmentId ? { establishmentId } : {}),
      ...(nameFilter || {}),
    };
    const items = await prisma.dependency.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take,
    });
    const total = await prisma.dependency.count({ where });
    return { total, skip, take, items };
  }

  if (user.role.type === "ADMIN_ESTABLISHMENT") {
    if (!user.establishmentId) throw badRequest("Usuario sin establishmentId");
    const where = {
      ...(includeInactive ? {} : { isActive: true }),
      establishmentId: user.establishmentId,
      ...(nameFilter || {}),
    };
    const items = await prisma.dependency.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take,
    });
    const total = await prisma.dependency.count({ where });
    return { total, skip, take, items };
  }

  if (user.role.type === "VIEWER") {
    if (!user.establishmentId) throw badRequest("Usuario sin establishmentId");
    const where = {
      ...(includeInactive ? {} : { isActive: true }),
      establishmentId: user.establishmentId,
      ...(nameFilter || {}),
    };
    const items = await prisma.dependency.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take,
    });
    const total = await prisma.dependency.count({ where });
    return { total, skip, take, items };
  }

  throw forbidden("Rol no permitido");
}

async function listAssetStates(query) {
  const take = clampTake(query.take);
  const skip = clampSkip(query.skip);
  const nameFilter = textFilter(query.q);
  const where = nameFilter ? { ...nameFilter } : undefined;

  const items = await prisma.assetState.findMany({
    where,
    orderBy: { name: "asc" },
    skip,
    take,
  });
  const total = await prisma.assetState.count({ where });
  return { total, skip, take, items };
}

async function listAssetTypes(query) {
  const take = clampTake(query.take);
  const skip = clampSkip(query.skip);
  const nameFilter = textFilter(query.q);
  const where = nameFilter ? { ...nameFilter } : undefined;

  const items = await prisma.assetType.findMany({
    where,
    orderBy: { name: "asc" },
    skip,
    take,
  });
  const total = await prisma.assetType.count({ where });
  return { total, skip, take, items };
}

async function listCatalogItems(query) {
  const take = clampTake(query.take);
  const skip = clampSkip(query.skip);
  const q = (query.q || "").trim();
  const where = {
    ...(query.category ? { category: query.category } : {}),
    ...(query.subcategory ? { subcategory: query.subcategory } : {}),
    ...(query.brand ? { brand: query.brand } : {}),
    ...(query.modelName ? { modelName: query.modelName } : {}),
  };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
      { subcategory: { contains: q, mode: "insensitive" } },
      { brand: { contains: q, mode: "insensitive" } },
      { modelName: { contains: q, mode: "insensitive" } },
      { officialKey: { contains: q, mode: "insensitive" } },
    ];
  }
  const items = await prisma.catalogItem.findMany({
    where,
    orderBy: { name: "asc" },
    skip,
    take,
  });
  const total = await prisma.catalogItem.count({ where });
  return { total, skip, take, items };
}

async function listCatalogCategories(query) {
  const take = Math.min(Math.max(Number(query.take) || 50, 1), 300);
  const skip = Math.max(Number(query.skip) || 0, 0);
  const q = String(query.q || "").trim();

  const where = q
    ? {
        category: {
          not: null,
          contains: q,
          mode: "insensitive",
        },
      }
    : { category: { not: null } };

  const grouped = await prisma.catalogItem.findMany({
    where,
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });

  const total = grouped.length;
  const items = grouped
    .slice(skip, skip + take)
    .map((r) => r.category)
    .filter(Boolean)
    .map((name) => ({ name }));

  return {
    total,
    skip,
    take,
    items,
  };
}

module.exports = {
  listInstitutions,
  listEstablishments,
  listDependencies,
  listAssetStates,
  listAssetTypes,
  listCatalogItems,
  listCatalogCategories,
};
