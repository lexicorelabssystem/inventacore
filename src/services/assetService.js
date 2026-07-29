const { prisma } = require("../prisma");
const { canCreateAsset, enforceEstablishmentScope } = require("../permissions/assetPermissions");
const { snapshotAsset } = require("./assetAuditService");
const {
  validateAcquisitionDate,
  validateAcquisitionValue,
  validateDateNotFuture,
  validateStringMax,
  MAX_NAME_LENGTH,
  MAX_SHORT_TEXT,
  normalizeCostCenter,
  normalizeRut,
  validateRutFormat,
  normalizeDepreciationRate,
  resolveDepreciationValues,
  validateUsefulLifeYears,
  validateDepreciationAnnualValue,
  validateDepreciationAnnualRate,
} = require("../utils/assetRules");
const {
  estimateUsefulLifeYearsChile,
  resolveUsefulLifeYearsFromPolicies,
} = require("../utils/chileDepreciationTable");
const {
  badRequest,
  forbidden,
  notFound,
  conflict,
} = require("../utils/httpError");
const { ensureUniqueAssetIdentity } = require("../utils/assetIdentity");

function assert(cond, error) {
  if (!cond) throw error;
}

function isPrismaUniqueConstraintError(err) {
  if (!err) return false;
  if (err.code === "P2002") return true;
  if (err.name === "PrismaClientKnownRequestError" && err.message) {
    return String(err.message).includes("Unique constraint failed");
  }
  return false;
}

function generateAnalyticCode({ institutionId, establishmentId, dependencyId, internalCode }) {
  const safeInternal = String(Number(internalCode) || 0).padStart(6, "0");
  return `AN-${institutionId}-${establishmentId}-${dependencyId}-${safeInternal}`;
}

async function createAsset(input, user) {
  assert(input?.establishmentId, badRequest("establishmentId requerido"));
  assert(input?.dependencyId, badRequest("dependencyId requerido"));
  assert(input?.assetStateId, badRequest("assetStateId requerido"));
  assert(input?.assetTypeId, badRequest("assetTypeId requerido"));
  if (!input?.name && !input?.catalogItemId) {
    throw badRequest("name requerido si no hay catalogItemId");
  }
  assert(input?.accountingAccount, badRequest("accountingAccount requerido"));
  assert(
    typeof input.acquisitionValue === "number" && input.acquisitionValue > 0,
    badRequest("acquisitionValue invalido")
  );
  assert(input?.acquisitionDate, badRequest("acquisitionDate requerido"));

  const valueError = validateAcquisitionValue(input.acquisitionValue);
  assert(!valueError, badRequest(valueError));
  const acquisitionDate = new Date(input.acquisitionDate);
  const dateError = validateAcquisitionDate(acquisitionDate);
  assert(!dateError, badRequest(dateError));
  const depreciationStartDate =
    input.depreciationStartDate === undefined || input.depreciationStartDate === null
      ? acquisitionDate
      : new Date(input.depreciationStartDate);
  const depreciationStartDateError = validateDateNotFuture(
    "depreciationStartDate",
    depreciationStartDate
  );
  assert(!depreciationStartDateError, badRequest(depreciationStartDateError));
  const nameError = validateStringMax("name", input.name, MAX_NAME_LENGTH);
  assert(!nameError, badRequest(nameError));
  const brandError = validateStringMax("brand", input.brand, MAX_SHORT_TEXT);
  assert(!brandError, badRequest(brandError));
  const modelError = validateStringMax("modelName", input.modelName, MAX_SHORT_TEXT);
  assert(!modelError, badRequest(modelError));
  const serialError = validateStringMax("serialNumber", input.serialNumber, MAX_SHORT_TEXT);
  assert(!serialError, badRequest(serialError));
  const qty = Number(input.quantity ?? 1);
  assert(Number.isInteger(qty) && qty > 0, badRequest("quantity invalido"));
  if (qty > 1 && input.serialNumber) {
    throw badRequest(
      "serialNumber no puede repetirse cuando quantity > 1. Crea activos individuales o deja serial vacio.",
      "ASSET_QUANTITY_SERIAL_CONFLICT"
    );
  }
  const accError = validateStringMax("accountingAccount", input.accountingAccount, MAX_SHORT_TEXT);
  assert(!accError, badRequest(accError));
  const responsibleNameError = validateStringMax(
    "responsibleName",
    input.responsibleName,
    MAX_SHORT_TEXT
  );
  assert(!responsibleNameError, badRequest(responsibleNameError));
  const normalizedResponsibleRut = normalizeRut(input.responsibleRut);
  const responsibleRutFormatError = validateRutFormat("responsibleRut", input.responsibleRut);
  assert(!responsibleRutFormatError, badRequest(responsibleRutFormatError));
  const responsibleRutError = validateStringMax("responsibleRut", normalizedResponsibleRut, MAX_SHORT_TEXT);
  assert(!responsibleRutError, badRequest(responsibleRutError));
  const responsibleRoleError = validateStringMax(
    "responsibleRole",
    input.responsibleRole,
    MAX_SHORT_TEXT
  );
  assert(!responsibleRoleError, badRequest(responsibleRoleError));
  const normalizedCostCenter = normalizeCostCenter(input.costCenter);
  const costCenterError = validateStringMax("costCenter", normalizedCostCenter, MAX_SHORT_TEXT);
  assert(!costCenterError, badRequest(costCenterError));
  const parsedUsefulLifeYears =
    input.usefulLifeYears === undefined || input.usefulLifeYears === null
      ? null
      : Number(input.usefulLifeYears);
  const parsedDepreciationAnnualValue =
    input.depreciationAnnualValue === undefined || input.depreciationAnnualValue === null
      ? null
      : Number(input.depreciationAnnualValue);
  const parsedDepreciationAnnualRate =
    input.depreciationAnnualRate === undefined || input.depreciationAnnualRate === null
      ? null
      : normalizeDepreciationRate(input.depreciationAnnualRate);
  const usefulLifeError = validateUsefulLifeYears(parsedUsefulLifeYears);
  assert(!usefulLifeError, badRequest(usefulLifeError));
  const depreciationRateError = validateDepreciationAnnualRate(parsedDepreciationAnnualRate);
  assert(!depreciationRateError, badRequest(depreciationRateError));

  enforceEstablishmentScope(user, input.establishmentId);
  if (!canCreateAsset(user, input.establishmentId)) {
    throw forbidden("No tienes permisos para crear assets en este establecimiento");
  }

  return prisma.$transaction(async (tx) => {
    const establishment = await tx.establishment.findUnique({
      where: { id: input.establishmentId },
      select: { id: true, institutionId: true, isActive: true },
    });
    assert(establishment, notFound("Establishment no existe"));
    assert(establishment.isActive, badRequest("Establishment inactivo"));
    if (input?.institutionId) {
      assert(
        establishment.institutionId === input.institutionId,
        badRequest("Establishment no pertenece a la institution")
      );
    }
    if (
      user.role.type === "ADMIN_ESTABLISHMENT" &&
      user.institutionId &&
      establishment.institutionId !== user.institutionId
    ) {
      throw forbidden("No autorizado para esta institution");
    }

    const dependency = await tx.dependency.findUnique({
      where: { id: input.dependencyId },
      select: { id: true, establishmentId: true, isActive: true },
    });
    assert(dependency, notFound("Sector no existe"));
    assert(dependency.isActive, badRequest("Sector inactivo"));
    assert(
      dependency.establishmentId === input.establishmentId,
      badRequest("Sector no pertenece al establishment")
    );

    const state = await tx.assetState.findUnique({
      where: { id: input.assetStateId },
    });
    assert(state, notFound("AssetState no existe"));

    const assetType = await tx.assetType.findUnique({
      where: { id: input.assetTypeId },
    });
    assert(assetType, notFound("AssetType no existe"));

    let catalogItem = null;
    if (input.catalogItemId) {
      catalogItem = await tx.catalogItem.findUnique({
        where: { id: input.catalogItemId },
      });
      assert(catalogItem, notFound("CatalogItem no existe"));
    }

    const activeDepreciationPolicies = await tx.depreciationPolicy.findMany({
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
    });

    const finalBrand = input.brand ?? catalogItem?.brand ?? null;
    const finalModel = input.modelName ?? catalogItem?.modelName ?? null;
    const finalSerial = input.serialNumber ?? null;
    const finalName = input.name ?? catalogItem?.name;
    const estimatedUsefulLifeYears =
      parsedUsefulLifeYears ||
      resolveUsefulLifeYearsFromPolicies(activeDepreciationPolicies, {
        accountingAccount: input.accountingAccount,
        category: catalogItem?.category,
        subcategory: catalogItem?.subcategory,
        acquisitionDate: input.acquisitionDate,
      }) ||
      estimateUsefulLifeYearsChile({
        name: finalName,
        accountingAccount: input.accountingAccount,
        assetTypeName: assetType?.name,
        category: catalogItem?.category,
        subcategory: catalogItem?.subcategory,
      });
    const depreciationResolution = resolveDepreciationValues({
      acquisitionValue: input.acquisitionValue,
      usefulLifeYears: estimatedUsefulLifeYears,
      depreciationAnnualValue: parsedDepreciationAnnualValue,
      depreciationAnnualRate: parsedDepreciationAnnualRate,
    });
    const depreciationValueError = validateDepreciationAnnualValue(
      depreciationResolution.depreciationAnnualValue,
      input.acquisitionValue
    );
    assert(!depreciationValueError, badRequest(depreciationValueError));
    await ensureUniqueAssetIdentity(tx, {
      serialNumber: finalSerial,
      brand: finalBrand,
      modelName: finalModel,
    });

    const createdAssets = [];
    for (let unit = 0; unit < qty; unit++) {
      let lastUniqueErr = null;
      let asset = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const seq = await tx.assetSequence.upsert({
            where: { institutionId: establishment.institutionId },
            update: { lastNumber: { increment: 1 } },
            create: { institutionId: establishment.institutionId, lastNumber: 1 },
          });

          let internalCode = seq.lastNumber;
          const existingBySeq = await tx.asset.findUnique({
            where: { internalCode },
            select: { id: true },
          });
          if (existingBySeq) {
            const maxCode = await tx.asset.aggregate({ _max: { internalCode: true } });
            internalCode = Number(maxCode?._max?.internalCode || 0) + 1;
          }

          const analyticCode = generateAnalyticCode({
            institutionId: establishment.institutionId,
            establishmentId: input.establishmentId,
            dependencyId: input.dependencyId,
            internalCode,
          });
          const analyticError = validateStringMax("analyticCode", analyticCode, MAX_SHORT_TEXT);
          assert(!analyticError, badRequest(analyticError));

          asset = await tx.asset.create({
            data: {
              internalCode,
              name: finalName,
              quantity: 1,
              brand: finalBrand,
              modelName: finalModel,
              serialNumber: finalSerial,
              accountingAccount: input.accountingAccount,
              analyticCode,
              responsibleName: input.responsibleName ?? null,
              responsibleRut: normalizedResponsibleRut,
              responsibleRole: input.responsibleRole ?? null,
              costCenter: normalizedCostCenter,
              acquisitionValue: input.acquisitionValue,
              acquisitionDate,
              depreciationStartDate,
              usefulLifeYears: depreciationResolution.usefulLifeYears,
              depreciationAnnualValue: depreciationResolution.depreciationAnnualValue,
              assetTypeId: input.assetTypeId,
              assetStateId: input.assetStateId,
              establishmentId: input.establishmentId,
              dependencyId: input.dependencyId,
              catalogItemId: catalogItem?.id ?? null,
            },
          });
          break;
        } catch (err) {
          if (isPrismaUniqueConstraintError(err)) {
            lastUniqueErr = err;
            continue;
          }
          throw err;
        }
      }

      if (!asset && lastUniqueErr) {
        throw conflict(
          "No se pudo generar codigo interno unico. Intenta nuevamente.",
          "ASSET_INTERNAL_CODE_CONFLICT"
        );
      }
      if (!asset) {
        throw conflict(
          "No se pudo crear el activo por conflicto de codigo interno.",
          "ASSET_INTERNAL_CODE_CONFLICT"
        );
      }

      await tx.movement.create({
        data: {
          type: "INVENTORY_CHECK",
          assetId: asset.id,
          fromDependencyId: null,
          toDependencyId: input.dependencyId,
          userId: user.id,
        },
      });

      await tx.assetAudit.create({
        data: {
          action: "CREATE",
          assetId: asset.id,
          userId: user.id,
          before: null,
          after: snapshotAsset(asset),
        },
      });

      createdAssets.push(asset);
    }

    if (createdAssets.length === 1) {
      return createdAssets[0];
    }

    return {
      createdCount: createdAssets.length,
      items: createdAssets,
    };
  });
}

module.exports = { createAsset };

