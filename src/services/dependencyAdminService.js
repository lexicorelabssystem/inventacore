const { prisma } = require("../prisma");
const { forbidden, notFound, conflict, badRequest } = require("../utils/httpError");
const { logAdminAudit } = require("./adminAuditService");
const {
  FORCE_DELETE_CONFIRMATION_TEXT,
  buildDependencyForceDeletePlan,
  purgeByForceDeletePlan,
} = require("./adminForceDeleteService");

const DEPENDENCY_CONFLICT_CODES = {
  ALREADY_INACTIVE: "DEPENDENCY_ALREADY_INACTIVE",
  ALREADY_ACTIVE: "DEPENDENCY_ALREADY_ACTIVE",
  HAS_ACTIVE_ASSETS: "DEPENDENCY_HAS_ACTIVE_ASSETS",
  HARD_DELETE_REQUIRES_INACTIVE: "DEPENDENCY_HARD_DELETE_REQUIRES_INACTIVE",
  HARD_DELETE_HAS_RELATIONS: "DEPENDENCY_HARD_DELETE_HAS_RELATIONS",
};

function requireCentral(user) {
  if (user.role.type !== "ADMIN_CENTRAL") {
    throw forbidden("Solo ADMIN_CENTRAL puede administrar sectores");
  }
}

function clampTake(take) {
  return Math.min(Math.max(take || 20, 1), 100);
}

function clampSkip(skip) {
  return Math.max(skip || 0, 0);
}

async function listDependencies(query, user) {
  requireCentral(user);
  const take = clampTake(query.take);
  const skip = clampSkip(query.skip);
  const q = (query.q || "").trim();
  const establishmentId =
    query.establishmentId !== undefined ? Number(query.establishmentId) : undefined;
  const includeInactive =
    query.includeInactive === true ||
    query.includeInactive === "true" ||
    query.includeInactive === "1";

  const where = {
    ...(includeInactive ? {} : { isActive: true }),
    ...(establishmentId ? { establishmentId } : {}),
    ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
  };

  const items = await prisma.dependency.findMany({
    where,
    orderBy: { name: "asc" },
    take,
    skip,
  });
  const total = await prisma.dependency.count({ where });

  return { total, skip, take, items };
}

async function getDependency(id, user) {
  requireCentral(user);
  const item = await prisma.dependency.findUnique({ where: { id } });
  if (!item) throw notFound("Sector no existe");
  return item;
}

async function createDependency(data, user) {
  requireCentral(user);
  const est = await prisma.establishment.findUnique({
    where: { id: data.establishmentId },
    select: { id: true, isActive: true },
  });
  if (!est) throw notFound("Establishment no existe");
  if (!est.isActive) throw conflict("Establecimiento inactivo");
  const dup = await prisma.dependency.findFirst({
    where: {
      name: data.name,
      establishmentId: data.establishmentId,
    },
  });
  if (dup) throw conflict("Ya existe un sector con ese nombre");
  const created = await prisma.dependency.create({ data });
  await logAdminAudit({
    userId: user.id,
    entityType: "DEPENDENCY",
    action: "CREATE",
    entityId: created.id,
    before: null,
    after: created,
  });
  return created;
}

async function updateDependency(id, data, user) {
  requireCentral(user);
  const exists = await prisma.dependency.findUnique({ where: { id } });
  if (!exists) throw notFound("Sector no existe");
  const targetEstId = data.establishmentId || exists.establishmentId;
  if (data.establishmentId) {
    const est = await prisma.establishment.findUnique({
      where: { id: data.establishmentId },
      select: { id: true, isActive: true },
    });
    if (!est) throw notFound("Establishment no existe");
    if (!est.isActive) throw conflict("Establecimiento inactivo");
  }
  if (data.name) {
    const dup = await prisma.dependency.findFirst({
      where: {
        name: data.name,
        establishmentId: targetEstId,
        NOT: { id },
      },
    });
    if (dup) throw conflict("Ya existe un sector con ese nombre");
  }
  const updated = await prisma.dependency.update({ where: { id }, data });
  await logAdminAudit({
    userId: user.id,
    entityType: "DEPENDENCY",
    action: "UPDATE",
    entityId: updated.id,
    before: exists,
    after: updated,
  });
  return updated;
}

async function deleteDependency(id, user) {
  requireCentral(user);
  const exists = await prisma.dependency.findUnique({ where: { id } });
  if (!exists) throw notFound("Sector no existe");
  if (!exists.isActive) {
    throw conflict(
      "Sector ya esta dado de baja",
      DEPENDENCY_CONFLICT_CODES.ALREADY_INACTIVE
    );
  }

  const activeAssets = await prisma.asset.count({
    where: {
      dependencyId: id,
      isDeleted: false,
    },
  });
  if (activeAssets > 0) {
    throw conflict(
      "No se puede dar de baja: hay activos vigentes asociados al sector",
      DEPENDENCY_CONFLICT_CODES.HAS_ACTIVE_ASSETS,
      { activeAssets }
    );
  }

  const deleted = await prisma.dependency.update({
    where: { id },
    data: { isActive: false },
  });
  await logAdminAudit({
    userId: user.id,
    entityType: "DEPENDENCY",
    action: "DEACTIVATE",
    entityId: deleted.id,
    before: exists,
    after: deleted,
  });
  return deleted;
}

async function reactivateDependency(id, user) {
  requireCentral(user);
  const exists = await prisma.dependency.findUnique({ where: { id } });
  if (!exists) throw notFound("Sector no existe");
  if (exists.isActive) {
    throw conflict(
      "Sector ya esta activo",
      DEPENDENCY_CONFLICT_CODES.ALREADY_ACTIVE
    );
  }
  const reactivated = await prisma.dependency.update({
    where: { id },
    data: { isActive: true },
  });
  await logAdminAudit({
    userId: user.id,
    entityType: "DEPENDENCY",
    action: "UPDATE",
    entityId: reactivated.id,
    before: exists,
    after: reactivated,
  });
  return reactivated;
}

async function deleteDependencyPermanent(id, user) {
  requireCentral(user);
  const exists = await prisma.dependency.findUnique({ where: { id } });
  if (!exists) throw notFound("Sector no existe");
  if (exists.isActive) {
    throw conflict(
      "Para eliminar definitivamente, primero debes dar de baja el sector",
      DEPENDENCY_CONFLICT_CODES.HARD_DELETE_REQUIRES_INACTIVE
    );
  }

  const [assets, movementsFrom, movementsTo, supportRequests] = await Promise.all([
    prisma.asset.count({ where: { dependencyId: id } }),
    prisma.movement.count({ where: { fromDependencyId: id } }),
    prisma.movement.count({ where: { toDependencyId: id } }),
    prisma.supportRequest.count({ where: { dependencyId: id } }),
  ]);

  if (assets > 0 || movementsFrom > 0 || movementsTo > 0 || supportRequests > 0) {
    throw conflict(
      "No se puede eliminar definitivamente: existen registros relacionados",
      DEPENDENCY_CONFLICT_CODES.HARD_DELETE_HAS_RELATIONS,
      { assets, movementsFrom, movementsTo, supportRequests }
    );
  }

  const deleted = await prisma.dependency.delete({ where: { id } });
  await logAdminAudit({
    userId: user.id,
    entityType: "DEPENDENCY",
    action: "DELETE",
    entityId: id,
    before: exists,
    after: null,
  });
  return { id: deleted.id, hardDeleted: true };
}

async function getDependencyForceDeleteSummary(id, user) {
  requireCentral(user);
  const exists = await prisma.dependency.findUnique({ where: { id } });
  if (!exists) throw notFound("Sector no existe");
  if (exists.isActive) {
    throw conflict(
      "Para eliminar forzado, primero debes dar de baja el sector",
      DEPENDENCY_CONFLICT_CODES.HARD_DELETE_REQUIRES_INACTIVE
    );
  }
  const plan = await buildDependencyForceDeletePlan(prisma, id);
  return {
    entityType: "DEPENDENCY",
    entityId: id,
    entityName: exists.name,
    confirmationText: FORCE_DELETE_CONFIRMATION_TEXT,
    summary: plan.summary,
  };
}

async function deleteDependencyPermanentForce(id, data, user) {
  requireCentral(user);
  const exists = await prisma.dependency.findUnique({ where: { id } });
  if (!exists) throw notFound("Sector no existe");
  if (exists.isActive) {
    throw conflict(
      "Para eliminar forzado, primero debes dar de baja el sector",
      DEPENDENCY_CONFLICT_CODES.HARD_DELETE_REQUIRES_INACTIVE
    );
  }
  if (String(data?.confirmationText || "").trim() !== FORCE_DELETE_CONFIRMATION_TEXT) {
    throw badRequest(
      `Debes confirmar con el texto exacto: ${FORCE_DELETE_CONFIRMATION_TEXT}`,
      "FORCE_DELETE_CONFIRMATION_INVALID"
    );
  }

  const plan = await buildDependencyForceDeletePlan(prisma, id);
  await prisma.$transaction(async (tx) => {
    await purgeByForceDeletePlan(tx, {
      ...plan,
      dependencyIds: [],
    });
    await tx.dependency.delete({ where: { id } });
    await logAdminAudit({
      userId: user.id,
      entityType: "DEPENDENCY",
      action: "DELETE",
      entityId: id,
      before: exists,
      after: {
        hardDeleted: true,
        forced: true,
        deletedSummary: plan.summary,
      },
      db: tx,
    });
  });
  return {
    id,
    hardDeleted: true,
    forced: true,
    summary: plan.summary,
  };
}

async function createDependenciesBulk(data, user) {
  requireCentral(user);
  const items = data.items || [];
  const normalized = [];
  const skipped = [];
  const seen = new Set();

  for (const item of items) {
    const name = String(item.name || "").trim();
    const establishmentId = Number(item.establishmentId);
    const key = `${establishmentId}::${name.toLowerCase()}`;
    if (seen.has(key)) {
      skipped.push({ name, establishmentId, reason: "DUPLICATE_IN_INPUT" });
      continue;
    }
    seen.add(key);
    normalized.push({ name, establishmentId });
  }

  const establishmentIds = [...new Set(normalized.map((i) => i.establishmentId))];
  const existingEstablishments = await prisma.establishment.findMany({
    where: { id: { in: establishmentIds } },
    select: { id: true },
  });
  const existingSet = new Set(existingEstablishments.map((e) => e.id));
  const missingIds = establishmentIds.filter((id) => !existingSet.has(id));
  if (missingIds.length) {
    throw badRequest("Establishment no existe", "ESTABLISHMENT_NOT_FOUND", {
      missingIds,
    });
  }

  const existingDeps = await prisma.dependency.findMany({
    where: { establishmentId: { in: establishmentIds } },
    select: { name: true, establishmentId: true },
  });
  const existingKeys = new Set(
    existingDeps.map(
      (d) => `${d.establishmentId}::${String(d.name).trim().toLowerCase()}`
    )
  );

  const toCreate = [];
  for (const item of normalized) {
    const key = `${item.establishmentId}::${item.name.toLowerCase()}`;
    if (existingKeys.has(key)) {
      skipped.push({ ...item, reason: "ALREADY_EXISTS" });
      continue;
    }
    toCreate.push(item);
  }

  const created = [];
  await prisma.$transaction(async (tx) => {
    for (const item of toCreate) {
      const createdItem = await tx.dependency.create({ data: item });
      created.push(createdItem);
      await logAdminAudit({
        userId: user.id,
        entityType: "DEPENDENCY",
        action: "CREATE",
        entityId: createdItem.id,
        before: null,
        after: createdItem,
      });
    }
  });

  return {
    createdCount: created.length,
    skippedCount: skipped.length,
    skipped,
    items: created,
  };
}

async function replicateDependencies(data, user) {
  requireCentral(user);
  const sourceEstablishmentId = Number(data.sourceEstablishmentId);
  const targetEstablishmentId = Number(data.targetEstablishmentId);
  const includeInactive = Boolean(data.includeInactive);

  if (sourceEstablishmentId === targetEstablishmentId) {
    throw badRequest(
      "El establecimiento origen y destino deben ser distintos",
      "DEPENDENCY_REPLICATE_SAME_ESTABLISHMENT"
    );
  }

  const [sourceEstablishment, targetEstablishment] = await Promise.all([
    prisma.establishment.findUnique({
      where: { id: sourceEstablishmentId },
      select: { id: true, name: true, isActive: true },
    }),
    prisma.establishment.findUnique({
      where: { id: targetEstablishmentId },
      select: { id: true, name: true, isActive: true },
    }),
  ]);

  if (!sourceEstablishment) throw notFound("Establecimiento origen no existe");
  if (!targetEstablishment) throw notFound("Establecimiento destino no existe");
  if (!targetEstablishment.isActive) {
    throw conflict("Establecimiento destino inactivo", "DEPENDENCY_REPLICATE_TARGET_INACTIVE");
  }

  const sourceDependencies = await prisma.dependency.findMany({
    where: {
      establishmentId: sourceEstablishmentId,
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: { name: "asc" },
    select: { name: true, isActive: true },
  });

  if (!sourceDependencies.length) {
    return {
      sourceEstablishmentId,
      targetEstablishmentId,
      sourceCount: 0,
      createdCount: 0,
      skippedCount: 0,
      skipped: [],
      items: [],
    };
  }

  const targetDependencies = await prisma.dependency.findMany({
    where: { establishmentId: targetEstablishmentId },
    select: { name: true },
  });
  const targetNameSet = new Set(
    targetDependencies.map((d) => String(d.name || "").trim().toLowerCase())
  );

  const toCreate = [];
  const skipped = [];
  for (const dep of sourceDependencies) {
    const normalizedName = String(dep.name || "").trim().toLowerCase();
    if (!normalizedName) {
      skipped.push({ name: dep.name, reason: "INVALID_NAME" });
      continue;
    }
    if (targetNameSet.has(normalizedName)) {
      skipped.push({ name: dep.name, reason: "ALREADY_EXISTS_IN_TARGET" });
      continue;
    }
    targetNameSet.add(normalizedName);
    toCreate.push({ name: dep.name, establishmentId: targetEstablishmentId });
  }

  const created = [];
  await prisma.$transaction(async (tx) => {
    for (const payload of toCreate) {
      const createdItem = await tx.dependency.create({ data: payload });
      created.push(createdItem);
      await logAdminAudit({
        db: tx,
        userId: user.id,
        entityType: "DEPENDENCY",
        action: "CREATE",
        entityId: createdItem.id,
        before: null,
        after: createdItem,
      });
    }
  });

  return {
    sourceEstablishmentId,
    sourceEstablishmentName: sourceEstablishment.name,
    targetEstablishmentId,
    targetEstablishmentName: targetEstablishment.name,
    sourceCount: sourceDependencies.length,
    createdCount: created.length,
    skippedCount: skipped.length,
    skipped,
    items: created,
  };
}

module.exports = {
  listDependencies,
  getDependency,
  createDependency,
  updateDependency,
  deleteDependency,
  reactivateDependency,
  deleteDependencyPermanent,
  getDependencyForceDeleteSummary,
  deleteDependencyPermanentForce,
  createDependenciesBulk,
  replicateDependencies,
};

