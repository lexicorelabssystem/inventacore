const { prisma } = require("../prisma");
const { forbidden, notFound, conflict, badRequest } = require("../utils/httpError");
const { logAdminAudit } = require("./adminAuditService");
const {
  FORCE_DELETE_CONFIRMATION_TEXT,
  buildInstitutionForceDeletePlan,
  purgeByForceDeletePlan,
} = require("./adminForceDeleteService");

const INSTITUTION_CONFLICT_CODES = {
  SINGLETON_LOCKED: "INSTITUTION_SINGLETON_LOCKED",
  ALREADY_INACTIVE: "INSTITUTION_ALREADY_INACTIVE",
  ALREADY_ACTIVE: "INSTITUTION_ALREADY_ACTIVE",
  HAS_ACTIVE_ESTABLISHMENTS: "INSTITUTION_HAS_ACTIVE_ESTABLISHMENTS",
  HAS_ACTIVE_USERS: "INSTITUTION_HAS_ACTIVE_USERS",
  HAS_ACTIVE_ASSETS: "INSTITUTION_HAS_ACTIVE_ASSETS",
  HARD_DELETE_REQUIRES_INACTIVE: "INSTITUTION_HARD_DELETE_REQUIRES_INACTIVE",
  HARD_DELETE_HAS_RELATIONS: "INSTITUTION_HARD_DELETE_HAS_RELATIONS",
};

function requireCentral(user) {
  if (user.role.type !== "ADMIN_CENTRAL") {
    throw forbidden("Solo ADMIN_CENTRAL puede administrar instituciones");
  }
}

function clampTake(take) {
  return Math.min(Math.max(take || 20, 1), 100);
}

function clampSkip(skip) {
  return Math.max(skip || 0, 0);
}

async function listInstitutions(query, user) {
  requireCentral(user);
  const take = clampTake(query.take);
  const skip = clampSkip(query.skip);
  const q = (query.q || "").trim();
  const includeInactive =
    query.includeInactive === true ||
    query.includeInactive === "true" ||
    query.includeInactive === "1";

  const where = {
    ...(includeInactive ? {} : { isActive: true }),
    ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
  };

  const items = await prisma.institution.findMany({
    where,
    orderBy: { name: "asc" },
    take,
    skip,
  });
  const total = await prisma.institution.count({ where });

  return { total, skip, take, items };
}

async function getInstitution(id, user) {
  requireCentral(user);
  const item = await prisma.institution.findUnique({ where: { id } });
  if (!item) throw notFound("Institution no existe");
  return item;
}

async function createInstitution(data, user) {
  requireCentral(user);
  const institutionCount = await prisma.institution.count();
  if (institutionCount >= 1) {
    throw conflict(
      "Este sistema permite mantener solo una institucion.",
      INSTITUTION_CONFLICT_CODES.SINGLETON_LOCKED,
      { institutionCount }
    );
  }
  const exists = await prisma.institution.findFirst({
    where: { name: data.name },
  });
  if (exists) throw conflict("Ya existe una institucion con ese nombre");
  const created = await prisma.institution.create({ data });
  await logAdminAudit({
    userId: user.id,
    entityType: "INSTITUTION",
    action: "CREATE",
    entityId: created.id,
    before: null,
    after: created,
  });
  return created;
}

async function updateInstitution(id, data, user) {
  requireCentral(user);
  const exists = await prisma.institution.findUnique({ where: { id } });
  if (!exists) throw notFound("Institution no existe");
  if (data.name && data.name !== exists.name) {
    const dup = await prisma.institution.findFirst({
      where: { name: data.name },
    });
    if (dup) throw conflict("Ya existe una institucion con ese nombre");
  }
  const updated = await prisma.institution.update({ where: { id }, data });
  await logAdminAudit({
    userId: user.id,
    entityType: "INSTITUTION",
    action: "UPDATE",
    entityId: updated.id,
    before: exists,
    after: updated,
  });
  return updated;
}

async function deleteInstitution(id, user) {
  requireCentral(user);
  const exists = await prisma.institution.findUnique({ where: { id } });
  if (!exists) throw notFound("Institution no existe");
  if (!exists.isActive) {
    throw conflict(
      "Institucion ya esta dada de baja",
      INSTITUTION_CONFLICT_CODES.ALREADY_INACTIVE
    );
  }

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const bajaState = await tx.assetState.findFirst({
      where: { name: "BAJA" },
      select: { id: true },
    });

    const deactivatedDependencies = await tx.dependency.updateMany({
      where: {
        isActive: true,
        establishment: { institutionId: id },
      },
      data: { isActive: false },
    });

    const deactivatedEstablishments = await tx.establishment.updateMany({
      where: { institutionId: id, isActive: true },
      data: { isActive: false },
    });

    const deactivatedUsers = await tx.user.updateMany({
      where: { institutionId: id, isActive: true },
      data: { isActive: false },
    });

    const deactivatedAssets = await tx.asset.updateMany({
      where: {
        isDeleted: false,
        establishment: { institutionId: id },
      },
      data: {
        isDeleted: true,
        deletedAt: now,
        deletedById: user.id,
        ...(bajaState ? { assetStateId: bajaState.id } : {}),
      },
    });

    const institution = await tx.institution.update({
      where: { id },
      data: { isActive: false },
    });

    return {
      institution,
      deactivatedEstablishments: deactivatedEstablishments.count,
      deactivatedDependencies: deactivatedDependencies.count,
      deactivatedUsers: deactivatedUsers.count,
      deactivatedAssets: deactivatedAssets.count,
    };
  });

  await logAdminAudit({
    userId: user.id,
    entityType: "INSTITUTION",
    action: "DEACTIVATE",
    entityId: result.institution.id,
    before: exists,
    after: {
      ...result.institution,
      cascade: {
        deactivatedEstablishments: result.deactivatedEstablishments,
        deactivatedDependencies: result.deactivatedDependencies,
        deactivatedUsers: result.deactivatedUsers,
        deactivatedAssets: result.deactivatedAssets,
      },
    },
  });

  return {
    ...result.institution,
    deactivatedEstablishments: result.deactivatedEstablishments,
    deactivatedDependencies: result.deactivatedDependencies,
    deactivatedUsers: result.deactivatedUsers,
    deactivatedAssets: result.deactivatedAssets,
  };
}

async function reactivateInstitution(id, user) {
  requireCentral(user);
  const exists = await prisma.institution.findUnique({ where: { id } });
  if (!exists) throw notFound("Institution no existe");
  if (exists.isActive) {
    throw conflict(
      "Institucion ya esta activa",
      INSTITUTION_CONFLICT_CODES.ALREADY_ACTIVE
    );
  }
  const reactivated = await prisma.institution.update({
    where: { id },
    data: { isActive: true },
  });
  await logAdminAudit({
    userId: user.id,
    entityType: "INSTITUTION",
    action: "UPDATE",
    entityId: reactivated.id,
    before: exists,
    after: reactivated,
  });
  return reactivated;
}

async function deleteInstitutionPermanent(id, user) {
  requireCentral(user);
  const exists = await prisma.institution.findUnique({ where: { id } });
  if (!exists) throw notFound("Institution no existe");
  if (exists.isActive) {
    throw conflict(
      "Para eliminar definitivamente, primero debes dar de baja la institucion",
      INSTITUTION_CONFLICT_CODES.HARD_DELETE_REQUIRES_INACTIVE
    );
  }

  const [establishments, users, assetSequences, supportRequests] = await Promise.all([
    prisma.establishment.count({ where: { institutionId: id } }),
    prisma.user.count({ where: { institutionId: id } }),
    prisma.assetSequence.count({ where: { institutionId: id } }),
    prisma.supportRequest.count({ where: { institutionId: id } }),
  ]);

  if (establishments > 0 || users > 0 || assetSequences > 0 || supportRequests > 0) {
    throw conflict(
      "No se puede eliminar definitivamente: existen registros relacionados",
      INSTITUTION_CONFLICT_CODES.HARD_DELETE_HAS_RELATIONS,
      { establishments, users, assetSequences, supportRequests }
    );
  }

  const deleted = await prisma.institution.delete({ where: { id } });
  await logAdminAudit({
    userId: user.id,
    entityType: "INSTITUTION",
    action: "DELETE",
    entityId: id,
    before: exists,
    after: null,
  });
  return { id: deleted.id, hardDeleted: true };
}

async function getInstitutionForceDeleteSummary(id, user) {
  requireCentral(user);
  const exists = await prisma.institution.findUnique({ where: { id } });
  if (!exists) throw notFound("Institution no existe");
  if (exists.isActive) {
    throw conflict(
      "Para eliminar forzado, primero debes dar de baja la institucion",
      INSTITUTION_CONFLICT_CODES.HARD_DELETE_REQUIRES_INACTIVE
    );
  }
  const plan = await buildInstitutionForceDeletePlan(prisma, id);
  return {
    entityType: "INSTITUTION",
    entityId: id,
    entityName: exists.name,
    confirmationText: FORCE_DELETE_CONFIRMATION_TEXT,
    summary: plan.summary,
  };
}

async function deleteInstitutionPermanentForce(id, data, user) {
  requireCentral(user);
  const exists = await prisma.institution.findUnique({ where: { id } });
  if (!exists) throw notFound("Institution no existe");
  if (exists.isActive) {
    throw conflict(
      "Para eliminar forzado, primero debes dar de baja la institucion",
      INSTITUTION_CONFLICT_CODES.HARD_DELETE_REQUIRES_INACTIVE
    );
  }
  if (String(data?.confirmationText || "").trim() !== FORCE_DELETE_CONFIRMATION_TEXT) {
    throw badRequest(
      `Debes confirmar con el texto exacto: ${FORCE_DELETE_CONFIRMATION_TEXT}`,
      "FORCE_DELETE_CONFIRMATION_INVALID"
    );
  }

  const plan = await buildInstitutionForceDeletePlan(prisma, id);
  await prisma.$transaction(async (tx) => {
    await purgeByForceDeletePlan(tx, {
      ...plan,
      institutionIds: [],
    });
    await tx.institution.delete({ where: { id } });
    await logAdminAudit({
      userId: user.id,
      entityType: "INSTITUTION",
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

module.exports = {
  listInstitutions,
  getInstitution,
  createInstitution,
  updateInstitution,
  deleteInstitution,
  reactivateInstitution,
  deleteInstitutionPermanent,
  getInstitutionForceDeleteSummary,
  deleteInstitutionPermanentForce,
};

