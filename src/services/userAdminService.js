const { prisma } = require("../prisma");
const { hashPassword } = require("../utils/password");
const { badRequest, conflict, forbidden, notFound } = require("../utils/httpError");
const { logAdminAudit } = require("./adminAuditService");
const {
  FORCE_DELETE_CONFIRMATION_TEXT,
  buildUserForceDeletePlan,
  purgeByForceDeletePlan,
} = require("./adminForceDeleteService");

const USER_CONFLICT_CODES = {
  DUPLICATE_EMAIL: "USER_DUPLICATE_EMAIL",
  ALREADY_INACTIVE: "USER_ALREADY_INACTIVE",
  ALREADY_ACTIVE: "USER_ALREADY_ACTIVE",
  HARD_DELETE_REQUIRES_INACTIVE: "USER_HARD_DELETE_REQUIRES_INACTIVE",
};
const USER_PHOTO_MIME_TYPES = new Set(["image/jpeg", "image/png"]);

function toPhotoDataUrl(photo) {
  if (!photo?.content || !photo?.mimeType) return null;
  const base64 = Buffer.from(photo.content).toString("base64");
  return `data:${photo.mimeType};base64,${base64}`;
}

function toUserDto(user) {
  const hasPhoto = Boolean(user.photo);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isActive: user.isActive,
    institutionId: user.institutionId,
    establishmentId: user.establishmentId,
    createdAt: user.createdAt,
    role: user.role,
    institution: user.institution,
    establishment: user.establishment,
    hasPhoto,
    photoDataUrl: hasPhoto ? toPhotoDataUrl(user.photo) : null,
  };
}

function requireCentral(user) {
  if (user.role.type !== "ADMIN_CENTRAL") {
    throw forbidden("Solo ADMIN_CENTRAL puede administrar usuarios");
  }
}

function clampTake(take) {
  return Math.min(Math.max(take || 20, 1), 100);
}

function clampSkip(skip) {
  return Math.max(skip || 0, 0);
}

async function listUsers(query, actor) {
  requireCentral(actor);

  const take = clampTake(query.take);
  const skip = clampSkip(query.skip);
  const q = (query.q || "").trim();
  const institutionId =
    query.institutionId !== undefined ? Number(query.institutionId) : undefined;
  const establishmentId =
    query.establishmentId !== undefined ? Number(query.establishmentId) : undefined;
  const roleType = query.roleType || undefined;
  const includeInactive =
    query.includeInactive === true ||
    query.includeInactive === "true" ||
    query.includeInactive === "1";

  const where = {
    ...(includeInactive ? {} : { isActive: true }),
    ...(Number.isFinite(institutionId) ? { institutionId } : {}),
    ...(Number.isFinite(establishmentId) ? { establishmentId } : {}),
    ...(roleType ? { role: { type: roleType } } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const items = await prisma.user.findMany({
    where,
    orderBy: { id: "desc" },
    skip,
    take,
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      institutionId: true,
      establishmentId: true,
      createdAt: true,
      role: { select: { type: true } },
      institution: { select: { id: true, name: true } },
      establishment: { select: { id: true, name: true } },
      photo: { select: { mimeType: true, content: true } },
    },
  });

  const total = await prisma.user.count({ where });
  return { total, skip, take, items: items.map(toUserDto) };
}

async function resolveUserAssignment(data) {
  const role = await prisma.role.findUnique({
    where: { type: data.roleType },
    select: { id: true, type: true },
  });
  if (!role) throw notFound("Rol no existe");

  const needsEstablishment = role.type !== "ADMIN_CENTRAL";
  if (needsEstablishment && !data.establishmentId) {
    throw badRequest("establishmentId requerido para este rol");
  }
  if (!needsEstablishment && data.establishmentId) {
    throw badRequest("ADMIN_CENTRAL no debe tener establishmentId");
  }

  let resolvedInstitutionId = undefined;
  let resolvedEstablishmentId = null;

  if (data.establishmentId) {
    const establishment = await prisma.establishment.findUnique({
      where: { id: data.establishmentId },
      select: { id: true, institutionId: true, isActive: true },
    });
    if (!establishment) throw notFound("Establishment no existe");
    if (!establishment.isActive) throw badRequest("Establishment inactivo");

    resolvedInstitutionId = establishment.institutionId;
    resolvedEstablishmentId = establishment.id;
  }

  if (!resolvedInstitutionId) {
    if (!data.institutionId) {
      throw badRequest("institutionId requerido cuando no hay establishmentId");
    }
    const institution = await prisma.institution.findUnique({
      where: { id: data.institutionId },
      select: { id: true, isActive: true },
    });
    if (!institution) throw notFound("Institution no existe");
    if (!institution.isActive) throw badRequest("Institution inactiva");
    resolvedInstitutionId = institution.id;
  } else if (data.institutionId && data.institutionId !== resolvedInstitutionId) {
    throw badRequest("institutionId no coincide con el establishment");
  }

  return { role, resolvedInstitutionId, resolvedEstablishmentId };
}

async function createUser(data, actor) {
  requireCentral(actor);

  const email = String(data.email).trim().toLowerCase();

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    throw conflict("Ya existe un usuario con ese email", USER_CONFLICT_CODES.DUPLICATE_EMAIL);
  }

  const { role, resolvedInstitutionId, resolvedEstablishmentId } =
    await resolveUserAssignment(data);

  const passwordHash = await hashPassword(data.password);

  const created = await prisma.$transaction(async (tx) => {
    const item = await tx.user.create({
      data: {
        name: data.name.trim(),
        email,
        password: passwordHash,
        isActive: true,
        roleId: role.id,
        institutionId: resolvedInstitutionId,
        establishmentId: resolvedEstablishmentId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        institutionId: true,
        establishmentId: true,
        createdAt: true,
        role: { select: { type: true } },
        photo: { select: { mimeType: true, content: true } },
      },
    });

    await logAdminAudit({
      userId: actor.id,
      entityType: "USER",
      action: "CREATE",
      entityId: item.id,
      before: null,
      after: item,
      db: tx,
    });

    return toUserDto(item);
  });

  return created;
}

async function updateUser(userId, data, actor) {
  requireCentral(actor);

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });
  if (!existing) throw notFound("Usuario no existe");

  if (data.roleType || data.institutionId || data.establishmentId) {
    const assignment = await resolveUserAssignment({
      roleType: data.roleType || existing.role.type,
      institutionId:
        data.institutionId !== undefined ? data.institutionId : existing.institutionId,
      establishmentId:
        data.establishmentId !== undefined
          ? data.establishmentId
          : existing.establishmentId,
    });

    const payload = {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      roleId: assignment.role.id,
      institutionId: assignment.resolvedInstitutionId,
      establishmentId: assignment.resolvedEstablishmentId,
    };

    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx.user.update({
        where: { id: userId },
        data: payload,
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          institutionId: true,
          establishmentId: true,
          createdAt: true,
          role: { select: { type: true } },
          photo: { select: { mimeType: true, content: true } },
        },
      });

      await logAdminAudit({
        userId: actor.id,
        entityType: "USER",
        action: "UPDATE",
        entityId: item.id,
        before: {
          id: existing.id,
          name: existing.name,
          email: existing.email,
          isActive: existing.isActive,
          roleType: existing.role.type,
          institutionId: existing.institutionId,
          establishmentId: existing.establishmentId,
        },
        after: item,
        db: tx,
      });

      return toUserDto(item);
    });

    return updated;
  }

  if (data.name === undefined) {
    throw badRequest("Sin campos para actualizar");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const item = await tx.user.update({
      where: { id: userId },
      data: { name: data.name.trim() },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        institutionId: true,
        establishmentId: true,
        createdAt: true,
        role: { select: { type: true } },
        photo: { select: { mimeType: true, content: true } },
      },
    });

    await logAdminAudit({
      userId: actor.id,
      entityType: "USER",
      action: "UPDATE",
      entityId: item.id,
      before: {
        id: existing.id,
        name: existing.name,
        email: existing.email,
        isActive: existing.isActive,
        roleType: existing.role.type,
        institutionId: existing.institutionId,
        establishmentId: existing.establishmentId,
      },
      after: item,
      db: tx,
    });

    return toUserDto(item);
  });

  return updated;
}

async function deactivateUser(userId, actor) {
  requireCentral(actor);

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });
  if (!existing) throw notFound("Usuario no existe");
  if (!existing.isActive) {
    throw conflict("Usuario ya esta inactivo", USER_CONFLICT_CODES.ALREADY_INACTIVE);
  }
  if (existing.id === actor.id) {
    throw badRequest("No puedes desactivar tu propio usuario");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const item = await tx.user.update({
      where: { id: userId },
      data: { isActive: false },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        institutionId: true,
        establishmentId: true,
        createdAt: true,
        role: { select: { type: true } },
        photo: { select: { mimeType: true, content: true } },
      },
    });

    await logAdminAudit({
      userId: actor.id,
      entityType: "USER",
      action: "DEACTIVATE",
      entityId: item.id,
      before: {
        id: existing.id,
        name: existing.name,
        email: existing.email,
        isActive: existing.isActive,
        roleType: existing.role.type,
        institutionId: existing.institutionId,
        establishmentId: existing.establishmentId,
      },
      after: item,
      db: tx,
    });

    return toUserDto(item);
  });

  return updated;
}

async function reactivateUser(userId, actor) {
  requireCentral(actor);

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });
  if (!existing) throw notFound("Usuario no existe");
  if (existing.isActive) {
    throw conflict("Usuario ya esta activo", USER_CONFLICT_CODES.ALREADY_ACTIVE);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const item = await tx.user.update({
      where: { id: userId },
      data: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        institutionId: true,
        establishmentId: true,
        createdAt: true,
        role: { select: { type: true } },
        photo: { select: { mimeType: true, content: true } },
      },
    });

    await logAdminAudit({
      userId: actor.id,
      entityType: "USER",
      action: "UPDATE",
      entityId: item.id,
      before: {
        id: existing.id,
        name: existing.name,
        email: existing.email,
        isActive: existing.isActive,
        roleType: existing.role.type,
        institutionId: existing.institutionId,
        establishmentId: existing.establishmentId,
      },
      after: item,
      db: tx,
    });

    return toUserDto(item);
  });

  return updated;
}

async function resetUserPassword(userId, data, actor) {
  requireCentral(actor);

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });
  if (!existing) throw notFound("Usuario no existe");
  if (existing.id === actor.id) {
    throw badRequest("Usa tu cambio de clave personal para tu propia cuenta");
  }

  const passwordHash = await hashPassword(data.password);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { password: passwordHash },
      select: { id: true },
    });

    await logAdminAudit({
      userId: actor.id,
      entityType: "USER",
      action: "UPDATE",
      entityId: userId,
      before: null,
      after: {
        passwordReset: true,
        email: existing.email,
      },
      db: tx,
    });
  });

  return {
    id: existing.id,
    email: existing.email,
    passwordReset: true,
  };
}

async function getUserForceDeleteSummary(userId, actor) {
  requireCentral(actor);
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) throw notFound("Usuario no existe");
  if (existing.isActive) {
    throw conflict(
      "Para eliminar forzado, primero debes desactivar el usuario",
      USER_CONFLICT_CODES.HARD_DELETE_REQUIRES_INACTIVE
    );
  }
  if (existing.id === actor.id) {
    throw badRequest("No puedes eliminarte forzadamente a ti mismo", "USER_FORCE_DELETE_SELF");
  }

  const plan = await buildUserForceDeletePlan(prisma, userId);
  return {
    entityType: "USER",
    entityId: userId,
    entityName: existing.email,
    confirmationText: FORCE_DELETE_CONFIRMATION_TEXT,
    summary: plan.summary,
  };
}

async function deleteUserPermanentForce(userId, data, actor) {
  requireCentral(actor);
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });
  if (!existing) throw notFound("Usuario no existe");
  if (existing.isActive) {
    throw conflict(
      "Para eliminar forzado, primero debes desactivar el usuario",
      USER_CONFLICT_CODES.HARD_DELETE_REQUIRES_INACTIVE
    );
  }
  if (existing.id === actor.id) {
    throw badRequest("No puedes eliminarte forzadamente a ti mismo", "USER_FORCE_DELETE_SELF");
  }
  if (String(data?.confirmationText || "").trim() !== FORCE_DELETE_CONFIRMATION_TEXT) {
    throw badRequest(
      `Debes confirmar con el texto exacto: ${FORCE_DELETE_CONFIRMATION_TEXT}`,
      "FORCE_DELETE_CONFIRMATION_INVALID"
    );
  }

  const plan = await buildUserForceDeletePlan(prisma, userId);
  await prisma.$transaction(async (tx) => {
    await purgeByForceDeletePlan(tx, {
      ...plan,
      userIds: [],
    });
    await tx.user.delete({ where: { id: userId } });
    await logAdminAudit({
      userId: actor.id,
      entityType: "USER",
      action: "DELETE",
      entityId: userId,
      before: {
        id: existing.id,
        name: existing.name,
        email: existing.email,
        isActive: existing.isActive,
        roleType: existing.role?.type,
        institutionId: existing.institutionId,
        establishmentId: existing.establishmentId,
      },
      after: {
        hardDeleted: true,
        forced: true,
        deletedSummary: plan.summary,
      },
      db: tx,
    });
  });

  return {
    id: userId,
    hardDeleted: true,
    forced: true,
    summary: plan.summary,
  };
}

async function setUserPhoto(userId, file, actor) {
  requireCentral(actor);
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true, photo: true },
  });
  if (!existing) throw notFound("Usuario no existe");
  if (!file?.buffer) throw badRequest("Archivo de foto requerido");
  if (!USER_PHOTO_MIME_TYPES.has(file.mimetype)) {
    throw badRequest("Formato de foto no permitido. Usa JPG o PNG");
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.userPhoto.upsert({
      where: { userId },
      create: {
        userId,
        mimeType: file.mimetype,
        content: file.buffer,
      },
      update: {
        mimeType: file.mimetype,
        content: file.buffer,
      },
    });

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        institutionId: true,
        establishmentId: true,
        createdAt: true,
        role: { select: { type: true } },
        photo: { select: { mimeType: true, content: true } },
      },
    });

    await logAdminAudit({
      userId: actor.id,
      entityType: "USER",
      action: "UPDATE",
      entityId: userId,
      before: { hasPhoto: Boolean(existing.photo) },
      after: { hasPhoto: true },
      db: tx,
    });

    return toUserDto(user);
  });

  return updated;
}

async function clearUserPhoto(userId, actor) {
  requireCentral(actor);
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true, photo: true },
  });
  if (!existing) throw notFound("Usuario no existe");

  const updated = await prisma.$transaction(async (tx) => {
    await tx.userPhoto.deleteMany({ where: { userId } });

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        institutionId: true,
        establishmentId: true,
        createdAt: true,
        role: { select: { type: true } },
        photo: { select: { mimeType: true, content: true } },
      },
    });

    await logAdminAudit({
      userId: actor.id,
      entityType: "USER",
      action: "UPDATE",
      entityId: userId,
      before: { hasPhoto: Boolean(existing.photo) },
      after: { hasPhoto: false },
      db: tx,
    });

    return toUserDto(user);
  });

  return updated;
}

module.exports = {
  createUser,
  listUsers,
  updateUser,
  deactivateUser,
  reactivateUser,
  resetUserPassword,
  getUserForceDeleteSummary,
  deleteUserPermanentForce,
  setUserPhoto,
  clearUserPhoto,
};
