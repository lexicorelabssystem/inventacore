const DEFAULT_RESPONSIBLE_ROLE = "Encargado de Sector";

function normalizeText(value) {
  const text = String(value || "").trim();
  return text ? text : null;
}

function normalizeResponsiblePayload(payload) {
  return {
    responsibleName: normalizeText(payload?.responsibleName),
    responsibleRut: normalizeText(payload?.responsibleRut),
    responsibleRole: normalizeText(payload?.responsibleRole),
  };
}

function normalizeCandidate(candidate) {
  const normalized = normalizeResponsiblePayload({
    responsibleName: candidate?.responsibleName ?? candidate?.name,
    responsibleRut: candidate?.responsibleRut ?? candidate?.rut,
    responsibleRole: candidate?.responsibleRole ?? candidate?.role,
  });
  if (!normalized.responsibleName) return null;
  if (!normalized.responsibleRole) {
    normalized.responsibleRole = DEFAULT_RESPONSIBLE_ROLE;
  }
  return normalized;
}

function candidateKey(candidate) {
  return [
    String(candidate?.responsibleName || "").toLowerCase(),
    String(candidate?.responsibleRut || "").toLowerCase(),
    String(candidate?.responsibleRole || "").toLowerCase(),
  ].join("::");
}

function bumpCounter(counterMap, key, candidate) {
  if (!counterMap.has(key)) {
    counterMap.set(key, { count: 0, candidate });
  }
  counterMap.get(key).count += 1;
}

function selectTopCandidate(counterMap) {
  const ranked = Array.from(counterMap.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return String(a.candidate?.responsibleName || "").localeCompare(
      String(b.candidate?.responsibleName || ""),
      "es",
      { sensitivity: "base" }
    );
  });
  return ranked[0]?.candidate || null;
}

function buildResponsibleLookup({ assets = [], users = [] } = {}) {
  const byDependencyCounters = new Map();
  const byEstablishmentCounters = new Map();
  const userByEstablishment = new Map();

  for (const asset of assets) {
    const establishmentId = Number(asset?.establishmentId || 0);
    const dependencyId = Number(asset?.dependencyId || 0);
    if (!Number.isInteger(establishmentId) || establishmentId <= 0) continue;
    const candidate = normalizeCandidate(asset);
    if (!candidate) continue;
    const key = candidateKey(candidate);

    if (Number.isInteger(dependencyId) && dependencyId > 0) {
      if (!byDependencyCounters.has(dependencyId)) {
        byDependencyCounters.set(dependencyId, new Map());
      }
      bumpCounter(byDependencyCounters.get(dependencyId), key, candidate);
    }

    if (!byEstablishmentCounters.has(establishmentId)) {
      byEstablishmentCounters.set(establishmentId, new Map());
    }
    bumpCounter(byEstablishmentCounters.get(establishmentId), key, candidate);
  }

  for (const user of users) {
    const establishmentId = Number(user?.establishmentId || 0);
    if (!Number.isInteger(establishmentId) || establishmentId <= 0) continue;
    const roleType = String(user?.role?.type || "");
    const priority = roleType === "ADMIN_ESTABLISHMENT" ? 0 : roleType === "ADMIN_CENTRAL" ? 1 : 2;
    const candidate = normalizeCandidate({
      name: user?.name,
      role: DEFAULT_RESPONSIBLE_ROLE,
    });
    if (!candidate) continue;
    const existing = userByEstablishment.get(establishmentId);
    if (!existing || priority < existing.priority) {
      userByEstablishment.set(establishmentId, { priority, candidate });
    }
  }

  const byDependency = new Map();
  for (const [dependencyId, counterMap] of byDependencyCounters.entries()) {
    const top = selectTopCandidate(counterMap);
    if (top) byDependency.set(dependencyId, top);
  }

  const byEstablishment = new Map();
  for (const [establishmentId, counterMap] of byEstablishmentCounters.entries()) {
    const top = selectTopCandidate(counterMap);
    if (top) byEstablishment.set(establishmentId, top);
  }

  return {
    byDependency,
    byEstablishment,
    userByEstablishment,
  };
}

function registerResponsibleInLookup(lookup, context, payload) {
  if (!lookup) return;
  const candidate = normalizeCandidate(payload);
  if (!candidate) return;
  const establishmentId = Number(context?.establishmentId || 0);
  const dependencyId = Number(context?.dependencyId || 0);
  if (Number.isInteger(dependencyId) && dependencyId > 0) {
    lookup.byDependency.set(dependencyId, candidate);
  }
  if (Number.isInteger(establishmentId) && establishmentId > 0) {
    lookup.byEstablishment.set(establishmentId, candidate);
  }
}

function resolveResponsibleFromLookup(lookup, context = {}) {
  if (!lookup) return null;
  const dependencyId = Number(context?.dependencyId || 0);
  const establishmentId = Number(context?.establishmentId || 0);

  if (Number.isInteger(dependencyId) && dependencyId > 0) {
    const byDependency = lookup.byDependency.get(dependencyId);
    if (byDependency) return byDependency;
  }

  if (Number.isInteger(establishmentId) && establishmentId > 0) {
    const byEstablishment = lookup.byEstablishment.get(establishmentId);
    if (byEstablishment) return byEstablishment;
    const fromUser = lookup.userByEstablishment.get(establishmentId)?.candidate;
    if (fromUser) return fromUser;
  }

  return normalizeCandidate({
    name: context?.fallbackUserName,
    role: DEFAULT_RESPONSIBLE_ROLE,
  });
}

async function findMostFrequentResponsible(prismaClient, where) {
  const rows = await prismaClient.asset.findMany({
    where: {
      ...where,
      isDeleted: false,
      responsibleName: { not: null },
    },
    select: {
      responsibleName: true,
      responsibleRut: true,
      responsibleRole: true,
    },
  });

  const counters = new Map();
  for (const row of rows) {
    const candidate = normalizeCandidate(row);
    if (!candidate) continue;
    const key = candidateKey(candidate);
    bumpCounter(counters, key, candidate);
  }
  return selectTopCandidate(counters);
}

async function resolveResponsibleFallback(prismaClient, context = {}) {
  const fromLookup = resolveResponsibleFromLookup(context.lookup, context);
  if (fromLookup) return fromLookup;

  const dependencyId = Number(context?.dependencyId || 0);
  const establishmentId = Number(context?.establishmentId || 0);

  if (Number.isInteger(dependencyId) && dependencyId > 0) {
    const fromDependency = await findMostFrequentResponsible(prismaClient, { dependencyId });
    if (fromDependency) return fromDependency;
  }

  if (Number.isInteger(establishmentId) && establishmentId > 0) {
    const fromEstablishment = await findMostFrequentResponsible(prismaClient, { establishmentId });
    if (fromEstablishment) return fromEstablishment;

    const users = await prismaClient.user.findMany({
      where: {
        isActive: true,
        establishmentId,
      },
      select: {
        name: true,
        role: { select: { type: true } },
      },
      orderBy: [{ roleId: "asc" }, { id: "asc" }],
    });
    const preferred =
      users.find((item) => item?.role?.type === "ADMIN_ESTABLISHMENT") || users[0] || null;
    const fromUser = normalizeCandidate({
      name: preferred?.name,
      role: DEFAULT_RESPONSIBLE_ROLE,
    });
    if (fromUser) return fromUser;
  }

  return normalizeCandidate({
    name: context?.fallbackUserName,
    role: DEFAULT_RESPONSIBLE_ROLE,
  });
}

function applyResponsibleFallback(payload, fallbackCandidate) {
  const normalized = normalizeResponsiblePayload(payload);
  if (normalized.responsibleName) return normalized;

  const fallback = normalizeCandidate(fallbackCandidate);
  if (!fallback) return normalized;

  return {
    responsibleName: fallback.responsibleName,
    responsibleRut: normalized.responsibleRut || fallback.responsibleRut || null,
    responsibleRole: normalized.responsibleRole || fallback.responsibleRole || null,
  };
}

module.exports = {
  DEFAULT_RESPONSIBLE_ROLE,
  buildResponsibleLookup,
  registerResponsibleInLookup,
  resolveResponsibleFromLookup,
  resolveResponsibleFallback,
  applyResponsibleFallback,
};
