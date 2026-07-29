const { prisma } = require("../prisma");
const { forbidden, notFound, conflict, badRequest } = require("../utils/httpError");
const { logAdminAudit } = require("./adminAuditService");
const {
  FORCE_DELETE_CONFIRMATION_TEXT,
  buildEstablishmentForceDeletePlan,
  purgeByForceDeletePlan,
} = require("./adminForceDeleteService");

const ESTABLISHMENT_CONFLICT_CODES = {
  ALREADY_INACTIVE: "ESTABLISHMENT_ALREADY_INACTIVE",
  ALREADY_ACTIVE: "ESTABLISHMENT_ALREADY_ACTIVE",
  HAS_ACTIVE_DEPENDENCIES: "ESTABLISHMENT_HAS_ACTIVE_DEPENDENCIES",
  HAS_ACTIVE_USERS: "ESTABLISHMENT_HAS_ACTIVE_USERS",
  HAS_ACTIVE_ASSETS: "ESTABLISHMENT_HAS_ACTIVE_ASSETS",
  HARD_DELETE_REQUIRES_INACTIVE: "ESTABLISHMENT_HARD_DELETE_REQUIRES_INACTIVE",
  HARD_DELETE_HAS_RELATIONS: "ESTABLISHMENT_HARD_DELETE_HAS_RELATIONS",
};

function requireCentral(user) {
  if (user.role.type !== "ADMIN_CENTRAL") {
    throw forbidden("Solo ADMIN_CENTRAL puede administrar establecimientos");
  }
}

function clampTake(take) {
  return Math.min(Math.max(take || 20, 1), 100);
}

function clampSkip(skip) {
  return Math.max(skip || 0, 0);
}

async function listEstablishments(query, user) {
  requireCentral(user);
  const take = clampTake(query.take);
  const skip = clampSkip(query.skip);
  const q = (query.q || "").trim();
  const institutionId =
    query.institutionId !== undefined ? Number(query.institutionId) : undefined;
  const includeInactive =
    query.includeInactive === true ||
    query.includeInactive === "true" ||
    query.includeInactive === "1";

  const where = {
    ...(includeInactive ? {} : { isActive: true }),
    ...(institutionId ? { institutionId } : {}),
    ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
  };

  const items = await prisma.establishment.findMany({
    where,
    orderBy: { name: "asc" },
    take,
    skip,
  });
  const total = await prisma.establishment.count({ where });

  return { total, skip, take, items };
}

async function getEstablishment(id, user) {
  requireCentral(user);
  const item = await prisma.establishment.findUnique({ where: { id } });
  if (!item) throw notFound("Establishment no existe");
  return item;
}

async function createEstablishment(data, user) {
  requireCentral(user);
  const inst = await prisma.institution.findUnique({
    where: { id: data.institutionId },
    select: { id: true, isActive: true },
  });
  if (!inst) throw notFound("Institution no existe");
  if (!inst.isActive) throw conflict("Institution inactiva");
  const dup = await prisma.establishment.findFirst({
    where: {
      name: data.name,
      institutionId: data.institutionId,
    },
  });
  if (dup) throw conflict("Ya existe un establecimiento con ese nombre");
  const created = await prisma.establishment.create({ data });
  await logAdminAudit({
    userId: user.id,
    entityType: "ESTABLISHMENT",
    action: "CREATE",
    entityId: created.id,
    before: null,
    after: created,
  });
  return created;
}

async function updateEstablishment(id, data, user) {
  requireCentral(user);
  const exists = await prisma.establishment.findUnique({ where: { id } });
  if (!exists) throw notFound("Establishment no existe");
  const targetInstitutionId = data.institutionId || exists.institutionId;
  if (data.institutionId) {
    const inst = await prisma.institution.findUnique({
      where: { id: data.institutionId },
      select: { id: true, isActive: true },
    });
    if (!inst) throw notFound("Institution no existe");
    if (!inst.isActive) throw conflict("Institution inactiva");
  }
  if (data.name) {
    const dup = await prisma.establishment.findFirst({
      where: {
        name: data.name,
        institutionId: targetInstitutionId,
        NOT: { id },
      },
    });
    if (dup) throw conflict("Ya existe un establecimiento con ese nombre");
  }
  const updated = await prisma.establishment.update({ where: { id }, data });
  await logAdminAudit({
    userId: user.id,
    entityType: "ESTABLISHMENT",
    action: "UPDATE",
    entityId: updated.id,
    before: exists,
    after: updated,
  });
  return updated;
}

async function deleteEstablishment(id, user) {
  requireCentral(user);
  const exists = await prisma.establishment.findUnique({ where: { id } });
  if (!exists) throw notFound("Establishment no existe");
  if (!exists.isActive) {
    throw conflict(
      "Establecimiento ya esta dado de baja",
      ESTABLISHMENT_CONFLICT_CODES.ALREADY_INACTIVE
    );
  }

  const [activeUsers, activeAssets] = await Promise.all([
    prisma.user.count({
      where: { establishmentId: id, isActive: true },
    }),
    prisma.asset.count({
      where: { establishmentId: id, isDeleted: false },
    }),
  ]);

  if (activeUsers > 0) {
    throw conflict(
      "No se puede dar de baja: hay usuarios activos asociados",
      ESTABLISHMENT_CONFLICT_CODES.HAS_ACTIVE_USERS,
      { activeUsers }
    );
  }
  if (activeAssets > 0) {
    throw conflict(
      "No se puede dar de baja: hay activos vigentes asociados",
      ESTABLISHMENT_CONFLICT_CODES.HAS_ACTIVE_ASSETS,
      { activeAssets }
    );
  }

  const deleted = await prisma.$transaction(async (tx) => {
    const activeDependencies = await tx.dependency.findMany({
      where: { establishmentId: id, isActive: true },
      select: { id: true, name: true, establishmentId: true, isActive: true },
    });

    let autoDeactivatedDependencies = 0;
    if (activeDependencies.length > 0) {
      const depIds = activeDependencies.map((d) => d.id);
      const activeAssetsByDep = await tx.asset.groupBy({
        by: ["dependencyId"],
        where: {
          dependencyId: { in: depIds },
          isDeleted: false,
        },
        _count: { _all: true },
      });
      if (activeAssetsByDep.length > 0) {
        const blockedAssetsByDep = new Map(
          activeAssetsByDep.map((x) => [Number(x.dependencyId), Number(x._count?._all || 0)])
        );
        const blockedDependencies = activeDependencies
          .filter((dep) => blockedAssetsByDep.has(Number(dep.id)))
          .map((dep) => ({
            id: dep.id,
            name: dep.name,
            activeAssets: blockedAssetsByDep.get(Number(dep.id)) || 0,
          }));
        throw conflict(
          "No se puede dar de baja: hay sectores activos con activos vigentes asociados",
          ESTABLISHMENT_CONFLICT_CODES.HAS_ACTIVE_DEPENDENCIES,
          {
            activeDependencies: activeDependencies.length,
            blockedDependencyIds: activeAssetsByDep.map((x) => x.dependencyId),
            blockedDependencies,
          }
        );
      }

      const depDeactivation = await tx.dependency.updateMany({
        where: { id: { in: depIds }, isActive: true },
        data: { isActive: false },
      });
      autoDeactivatedDependencies = depDeactivation.count;

      for (const dep of activeDependencies) {
        await logAdminAudit({
          userId: user.id,
          entityType: "DEPENDENCY",
          action: "DEACTIVATE",
          entityId: dep.id,
          before: dep,
          after: { ...dep, isActive: false },
          db: tx,
        });
      }
    }

    const item = await tx.establishment.update({
      where: { id },
      data: { isActive: false },
    });

    await logAdminAudit({
      userId: user.id,
      entityType: "ESTABLISHMENT",
      action: "DEACTIVATE",
      entityId: item.id,
      before: exists,
      after: { ...item, autoDeactivatedDependencies },
      db: tx,
    });

    return { ...item, autoDeactivatedDependencies };
  });
  return deleted;
}

async function reactivateEstablishment(id, user) {
  requireCentral(user);
  const exists = await prisma.establishment.findUnique({ where: { id } });
  if (!exists) throw notFound("Establishment no existe");
  if (exists.isActive) {
    throw conflict(
      "Establecimiento ya esta activo",
      ESTABLISHMENT_CONFLICT_CODES.ALREADY_ACTIVE
    );
  }
  const reactivated = await prisma.establishment.update({
    where: { id },
    data: { isActive: true },
  });
  await logAdminAudit({
    userId: user.id,
    entityType: "ESTABLISHMENT",
    action: "UPDATE",
    entityId: reactivated.id,
    before: exists,
    after: reactivated,
  });
  return reactivated;
}

async function deleteEstablishmentPermanent(id, user) {
  requireCentral(user);
  const exists = await prisma.establishment.findUnique({ where: { id } });
  if (!exists) throw notFound("Establishment no existe");
  if (exists.isActive) {
    throw conflict(
      "Para eliminar definitivamente, primero debes dar de baja el establecimiento",
      ESTABLISHMENT_CONFLICT_CODES.HARD_DELETE_REQUIRES_INACTIVE
    );
  }

  const [dependencies, users, assets, supportRequests] = await Promise.all([
    prisma.dependency.count({ where: { establishmentId: id } }),
    prisma.user.count({ where: { establishmentId: id } }),
    prisma.asset.count({ where: { establishmentId: id } }),
    prisma.supportRequest.count({ where: { establishmentId: id } }),
  ]);

  if (dependencies > 0 || users > 0 || assets > 0 || supportRequests > 0) {
    throw conflict(
      "No se puede eliminar definitivamente: existen registros relacionados",
      ESTABLISHMENT_CONFLICT_CODES.HARD_DELETE_HAS_RELATIONS,
      { dependencies, users, assets, supportRequests }
    );
  }

  const deleted = await prisma.establishment.delete({ where: { id } });
  await logAdminAudit({
    userId: user.id,
    entityType: "ESTABLISHMENT",
    action: "DELETE",
    entityId: id,
    before: exists,
    after: null,
  });
  return { id: deleted.id, hardDeleted: true };
}

async function getEstablishmentForceDeleteSummary(id, user) {
  requireCentral(user);
  const exists = await prisma.establishment.findUnique({ where: { id } });
  if (!exists) throw notFound("Establishment no existe");
  if (exists.isActive) {
    throw conflict(
      "Para eliminar forzado, primero debes dar de baja el establecimiento",
      ESTABLISHMENT_CONFLICT_CODES.HARD_DELETE_REQUIRES_INACTIVE
    );
  }
  const plan = await buildEstablishmentForceDeletePlan(prisma, id);
  return {
    entityType: "ESTABLISHMENT",
    entityId: id,
    entityName: exists.name,
    confirmationText: FORCE_DELETE_CONFIRMATION_TEXT,
    summary: plan.summary,
    details: plan.details || null,
  };
}

async function deleteEstablishmentPermanentForce(id, data, user) {
  requireCentral(user);
  const exists = await prisma.establishment.findUnique({ where: { id } });
  if (!exists) throw notFound("Establishment no existe");
  if (exists.isActive) {
    throw conflict(
      "Para eliminar forzado, primero debes dar de baja el establecimiento",
      ESTABLISHMENT_CONFLICT_CODES.HARD_DELETE_REQUIRES_INACTIVE
    );
  }
  if (String(data?.confirmationText || "").trim() !== FORCE_DELETE_CONFIRMATION_TEXT) {
    throw badRequest(
      `Debes confirmar con el texto exacto: ${FORCE_DELETE_CONFIRMATION_TEXT}`,
      "FORCE_DELETE_CONFIRMATION_INVALID"
    );
  }

  const plan = await buildEstablishmentForceDeletePlan(prisma, id);
  await prisma.$transaction(async (tx) => {
    await purgeByForceDeletePlan(tx, {
      ...plan,
      establishmentIds: [],
    });
    await tx.establishment.delete({ where: { id } });
    await logAdminAudit({
      userId: user.id,
      entityType: "ESTABLISHMENT",
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

async function createEstablishmentsBulk(data, user) {
  requireCentral(user);
  const items = data.items || [];
  const normalized = [];
  const skipped = [];
  const seen = new Set();

  for (const item of items) {
    const name = String(item.name || "").trim();
    const type = String(item.type || "").trim();
    const rbd = item.rbd ? String(item.rbd).trim() : null;
    const commune = item.commune ? String(item.commune).trim() : null;
    const institutionId = Number(item.institutionId);
    const key = `${institutionId}::${name.toLowerCase()}`;
    if (seen.has(key)) {
      skipped.push({ name, institutionId, reason: "DUPLICATE_IN_INPUT" });
      continue;
    }
    seen.add(key);
    normalized.push({ name, type, rbd, commune, institutionId });
  }

  const institutionIds = [...new Set(normalized.map((i) => i.institutionId))];
  const existingInstitutions = await prisma.institution.findMany({
    where: { id: { in: institutionIds } },
    select: { id: true },
  });
  const existingSet = new Set(existingInstitutions.map((i) => i.id));
  const missingIds = institutionIds.filter((id) => !existingSet.has(id));
  if (missingIds.length) {
    throw badRequest("Institution no existe", "INSTITUTION_NOT_FOUND", {
      missingIds,
    });
  }

  const existingEstablishments = await prisma.establishment.findMany({
    where: { institutionId: { in: institutionIds } },
    select: { name: true, institutionId: true },
  });
  const existingKeys = new Set(
    existingEstablishments.map(
      (e) => `${e.institutionId}::${String(e.name).trim().toLowerCase()}`
    )
  );

  const toCreate = [];
  for (const item of normalized) {
    const key = `${item.institutionId}::${item.name.toLowerCase()}`;
    if (existingKeys.has(key)) {
      skipped.push({ ...item, reason: "ALREADY_EXISTS" });
      continue;
    }
    toCreate.push(item);
  }

  const created = [];
  await prisma.$transaction(async (tx) => {
    for (const item of toCreate) {
      const createdItem = await tx.establishment.create({ data: item });
      created.push(createdItem);
      await logAdminAudit({
        userId: user.id,
        entityType: "ESTABLISHMENT",
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

module.exports = {
  listEstablishments,
  getEstablishment,
  createEstablishment,
  updateEstablishment,
  deleteEstablishment,
  reactivateEstablishment,
  deleteEstablishmentPermanent,
  getEstablishmentForceDeleteSummary,
  deleteEstablishmentPermanentForce,
  createEstablishmentsBulk,
};

