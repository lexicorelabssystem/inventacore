function canCreateAsset(user, establishmentId) {
  if (user.role.type === "ADMIN_CENTRAL") return true;

  if (user.role.type === "ADMIN_ESTABLISHMENT") {
    return user.establishmentId === establishmentId;
  }

  return false;
}

function canDeleteAsset(user) {
  return user.role.type === "ADMIN_CENTRAL";
}

function canRelocateAsset(user, asset) {
  if (user.role.type === "ADMIN_CENTRAL") return true;

  if (user.role.type === "ADMIN_ESTABLISHMENT") {
    return asset.establishmentId === user.establishmentId;
  }

  return false;
}

function canTransferAsset(user) {
  return user.role.type === "ADMIN_CENTRAL";
}

function canChangeAssetStatus(user, asset) {
  if (user.role.type === "ADMIN_CENTRAL") return true;
  if (user.role.type === "ADMIN_ESTABLISHMENT") {
    return asset.establishmentId === user.establishmentId;
  }
  return false;
}

function canUpdateAsset(user, asset) {
  if (user.role.type === "ADMIN_CENTRAL") return true;
  if (user.role.type === "ADMIN_ESTABLISHMENT") {
    return asset.establishmentId === user.establishmentId;
  }
  return false;
}

const { badRequest, forbidden } = require("../utils/httpError");

function enforceEstablishmentScope(user, establishmentId) {
  if (user.role.type !== "ADMIN_ESTABLISHMENT") return;
  if (!user.establishmentId) {
    throw badRequest("ADMIN_ESTABLISHMENT sin establishmentId");
  }
  if (user.establishmentId !== establishmentId) {
    throw forbidden("No autorizado para este establecimiento");
  }
}

module.exports = {
  canCreateAsset,
  canDeleteAsset,
  canRelocateAsset,
  canTransferAsset,
  canChangeAssetStatus,
  canUpdateAsset,
  enforceEstablishmentScope,
};
