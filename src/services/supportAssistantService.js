const { prisma } = require("../prisma");
const { badRequest, forbidden, notFound } = require("../utils/httpError");
const { sendSupportRequestCreatedEmail } = require("./mailerService");
const { sendSupportProbeEmail } = require("./mailerService");

const SUPPORT_CONFLICT_CODES = {
  INVALID_SCOPE: "SUPPORT_INVALID_SCOPE",
  INVALID_STATUS: "SUPPORT_INVALID_STATUS",
};

function requireCentral(user) {
  if (user.role.type !== "ADMIN_CENTRAL") {
    throw forbidden("Solo ADMIN_CENTRAL puede usar Asistente Central");
  }
}

function clampTake(take) {
  return Math.min(Math.max(take || 20, 1), 100);
}

function clampSkip(skip) {
  return Math.max(skip || 0, 0);
}

function normalizeText(input) {
  return String(input || "").trim();
}

function nowPlusHours(hours) {
  const ms = Math.max(1, Number(hours) || 72) * 60 * 60 * 1000;
  return new Date(Date.now() + ms);
}

async function resolveScope(scope) {
  const result = {
    institutionId: scope.institutionId || null,
    establishmentId: scope.establishmentId || null,
    dependencyId: scope.dependencyId || null,
  };

  if (result.dependencyId) {
    const dependency = await prisma.dependency.findUnique({
      where: { id: result.dependencyId },
      select: { id: true, establishmentId: true, establishment: { select: { institutionId: true } } },
    });
    if (!dependency) {
      throw badRequest("dependencyId no existe", SUPPORT_CONFLICT_CODES.INVALID_SCOPE);
    }
    result.establishmentId = dependency.establishmentId;
    result.institutionId = dependency.establishment?.institutionId || result.institutionId;
    return result;
  }

  if (result.establishmentId) {
    const establishment = await prisma.establishment.findUnique({
      where: { id: result.establishmentId },
      select: { id: true, institutionId: true },
    });
    if (!establishment) {
      throw badRequest("establishmentId no existe", SUPPORT_CONFLICT_CODES.INVALID_SCOPE);
    }
    result.institutionId = establishment.institutionId;
    return result;
  }

  if (result.institutionId) {
    const institution = await prisma.institution.findUnique({
      where: { id: result.institutionId },
      select: { id: true },
    });
    if (!institution) {
      throw badRequest("institutionId no existe", SUPPORT_CONFLICT_CODES.INVALID_SCOPE);
    }
  }

  return result;
}

function buildHeuristicAnswer(question, context) {
  const q = question.toLowerCase();
  const suggestions = [];

  if (q.includes("transfer") || q.includes("traspas")) {
    suggestions.push("Revisar que el activo no este dado de baja y exigir reasonCode + evidencia.");
    suggestions.push("Confirmar sector destino antes de ejecutar la transferencia.");
  }
  if (q.includes("baja") || q.includes("restaur")) {
    suggestions.push("Validar motivo estructurado y evidencia obligatoria para baja/restauracion.");
  }
  if (q.includes("import") || q.includes("excel") || q.includes("catalog")) {
    suggestions.push("Validar formato de columnas y revisar reporte created/skipped/errors.");
    suggestions.push("Priorizar deduplicacion por officialKey para evitar catalogo duplicado.");
  }
  if (q.includes("usuario") || q.includes("rol") || q.includes("permiso")) {
    suggestions.push("Revisar rol del usuario y establecimiento asignado antes de guardar cambios.");
  }

  if (!suggestions.length) {
    suggestions.push("Levantar solicitud en mesa central con alcance e impacto.");
    suggestions.push("Adjuntar requestId/codigo de error para acelerar el diagnostico.");
  }

  const answer =
    "Analisis inicial completado. " +
    `Activos vigentes: ${context.assetsActive}. ` +
    `Solicitudes abiertas: ${context.openRequests}. ` +
    `Vencidas: ${context.overdueRequests}. ` +
    "Siguiente accion recomendada: " +
    suggestions[0];

  return {
    answer,
    suggestions,
    suggestedSubject: `Consulta central: ${question.slice(0, 80) || "sin asunto"}`,
    suggestedPriority: context.overdueRequests > 0 ? "HIGH" : "MEDIUM",
  };
}

async function askAssistant(payload, actor) {
  requireCentral(actor);
  const question = normalizeText(payload.question);
  if (question.length < 5) {
    throw badRequest("La consulta debe tener al menos 5 caracteres");
  }

  const scope = await resolveScope({
    institutionId: payload.institutionId ? Number(payload.institutionId) : null,
    establishmentId: payload.establishmentId ? Number(payload.establishmentId) : null,
    dependencyId: payload.dependencyId ? Number(payload.dependencyId) : null,
  });

  const whereScopeAssets = {
    isDeleted: false,
    ...(scope.institutionId ? { establishment: { institutionId: scope.institutionId } } : {}),
    ...(scope.establishmentId ? { establishmentId: scope.establishmentId } : {}),
    ...(scope.dependencyId ? { dependencyId: scope.dependencyId } : {}),
  };

  const whereScopeRequests = {
    ...(scope.institutionId ? { institutionId: scope.institutionId } : {}),
    ...(scope.establishmentId ? { establishmentId: scope.establishmentId } : {}),
    ...(scope.dependencyId ? { dependencyId: scope.dependencyId } : {}),
  };

  const [assetsActive, openRequests, overdueRequests] = await Promise.all([
    prisma.asset.count({ where: whereScopeAssets }),
    prisma.supportRequest.count({
      where: {
        ...whereScopeRequests,
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
    }),
    prisma.supportRequest.count({
      where: {
        ...whereScopeRequests,
        status: "OVERDUE",
      },
    }),
  ]);

  const heuristic = buildHeuristicAnswer(question, {
    assetsActive,
    openRequests,
    overdueRequests,
  });

  return {
    question,
    scope,
    context: { assetsActive, openRequests, overdueRequests },
    ...heuristic,
  };
}

async function createSupportRequest(payload, actor) {
  requireCentral(actor);
  const question = normalizeText(payload.question);
  if (!question) throw badRequest("question es requerido");

  const subject = normalizeText(payload.subject) || `Solicitud: ${question.slice(0, 120)}`;
  const responseDraft = normalizeText(payload.responseDraft) || null;
  const fallbackSupportEmail = normalizeText(process.env.SUPPORT_NOTIFY_EMAIL);
  const contactEmail = normalizeText(payload.contactEmail) || fallbackSupportEmail || null;
  const dueHours = payload.dueHours !== undefined ? Number(payload.dueHours) : 72;
  if (!Number.isFinite(dueHours) || dueHours < 1 || dueHours > 720) {
    throw badRequest("dueHours debe estar entre 1 y 720");
  }

  const scope = await resolveScope({
    institutionId: payload.institutionId ? Number(payload.institutionId) : null,
    establishmentId: payload.establishmentId ? Number(payload.establishmentId) : null,
    dependencyId: payload.dependencyId ? Number(payload.dependencyId) : null,
  });

  const created = await prisma.supportRequest.create({
    data: {
      subject,
      question,
      responseDraft,
      priority: payload.priority || "MEDIUM",
      dueAt: nowPlusHours(dueHours),
      source: payload.source || "ASSISTANT_UI",
      createdById: actor.id,
      institutionId: scope.institutionId,
      establishmentId: scope.establishmentId,
      dependencyId: scope.dependencyId,
      ...(contactEmail
        ? {
            comments: {
              create: [
                {
                  message: `Contacto de notificacion: ${contactEmail}`,
                  authorId: actor.id,
                },
              ],
            },
          }
        : {}),
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      institution: { select: { id: true, name: true } },
      establishment: { select: { id: true, name: true } },
      dependency: { select: { id: true, name: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  if (!contactEmail) return created;

  let delivery = { status: "skipped", reason: "CONTACT_EMAIL_EMPTY" };
  try {
    delivery = await sendSupportRequestCreatedEmail({
      to: contactEmail,
      request: created,
      actor,
    });
  } catch (error) {
    delivery = {
      status: "failed",
      reason: error?.message || "SMTP_SEND_FAILED",
    };
  }

  return {
    ...created,
    notificationEmail: contactEmail,
    emailDelivery: delivery,
  };
}

async function syncOverdueSupportRequests() {
  await prisma.supportRequest.updateMany({
    where: {
      status: { in: ["OPEN", "IN_PROGRESS"] },
      dueAt: { lt: new Date() },
    },
    data: { status: "OVERDUE" },
  });
}

async function listSupportRequests(query, actor) {
  requireCentral(actor);
  await syncOverdueSupportRequests();

  const take = clampTake(query.take);
  const skip = clampSkip(query.skip);
  const q = normalizeText(query.q);
  const status = query.status || undefined;
  const priority = query.priority || undefined;
  const institutionId = query.institutionId !== undefined ? Number(query.institutionId) : undefined;
  const establishmentId =
    query.establishmentId !== undefined ? Number(query.establishmentId) : undefined;
  const dependencyId = query.dependencyId !== undefined ? Number(query.dependencyId) : undefined;

  const where = {
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(Number.isFinite(institutionId) ? { institutionId } : {}),
    ...(Number.isFinite(establishmentId) ? { establishmentId } : {}),
    ...(Number.isFinite(dependencyId) ? { dependencyId } : {}),
    ...(q
      ? {
          OR: [
            { subject: { contains: q, mode: "insensitive" } },
            { question: { contains: q, mode: "insensitive" } },
            { createdBy: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.supportRequest.findMany({
      where,
      orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
      skip,
      take,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        institution: { select: { id: true, name: true } },
        establishment: { select: { id: true, name: true } },
        dependency: { select: { id: true, name: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, name: true, email: true } } },
        },
      },
    }),
    prisma.supportRequest.count({ where }),
  ]);

  return { total, skip, take, items };
}

async function updateSupportRequestStatus(id, payload, actor) {
  requireCentral(actor);
  const item = await prisma.supportRequest.findUnique({ where: { id: Number(id) } });
  if (!item) throw notFound("Solicitud no existe");

  const nextStatus = payload.status;
  const allowed = new Set(["OPEN", "IN_PROGRESS", "RESOLVED", "OVERDUE"]);
  if (!allowed.has(nextStatus)) {
    throw badRequest("Estado no valido", SUPPORT_CONFLICT_CODES.INVALID_STATUS);
  }

  const updated = await prisma.supportRequest.update({
    where: { id: Number(id) },
    data: {
      status: nextStatus,
      resolvedAt: nextStatus === "RESOLVED" ? new Date() : null,
      assignedToId: payload.assignedToId ? Number(payload.assignedToId) : undefined,
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      institution: { select: { id: true, name: true } },
      establishment: { select: { id: true, name: true } },
      dependency: { select: { id: true, name: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  return updated;
}

async function addSupportRequestComment(id, payload, actor) {
  requireCentral(actor);
  const requestId = Number(id);
  const message = normalizeText(payload.message);
  if (!message) throw badRequest("message es requerido");

  const request = await prisma.supportRequest.findUnique({ where: { id: requestId } });
  if (!request) throw notFound("Solicitud no existe");

  await prisma.supportRequestComment.create({
    data: {
      requestId,
      authorId: actor.id,
      message,
    },
  });

  const updated = await prisma.supportRequest.findUnique({
    where: { id: requestId },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      institution: { select: { id: true, name: true } },
      establishment: { select: { id: true, name: true } },
      dependency: { select: { id: true, name: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  if (!updated) throw notFound("Solicitud no existe");
  return updated;
}

async function testSupportSmtp(payload, actor) {
  requireCentral(actor);
  const fallback = normalizeText(process.env.SUPPORT_NOTIFY_EMAIL);
  const targetEmail = normalizeText(payload?.email) || fallback;
  if (!targetEmail) {
    throw badRequest("email es requerido para prueba SMTP");
  }

  const delivery = await sendSupportProbeEmail({ to: targetEmail, actor });
  return {
    email: targetEmail,
    delivery,
  };
}

module.exports = {
  askAssistant,
  createSupportRequest,
  listSupportRequests,
  updateSupportRequestStatus,
  addSupportRequestComment,
  testSupportSmtp,
};
