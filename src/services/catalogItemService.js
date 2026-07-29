const { prisma } = require("../prisma");
const { badRequest } = require("../utils/httpError");

function clampTake(take) {
  return Math.min(Math.max(take || 20, 1), 100);
}

function clampSkip(skip) {
  return Math.max(skip || 0, 0);
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
    ];
  }

  const items = await prisma.catalogItem.findMany({
    where,
    orderBy: { name: "asc" },
    take,
    skip,
  });
  const total = await prisma.catalogItem.count({ where });
  return { total, skip, take, items };
}

module.exports = { listCatalogItems };
