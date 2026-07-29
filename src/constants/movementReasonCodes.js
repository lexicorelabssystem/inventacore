const MOVEMENT_REASON_CODES = {
  TRANSFER: [
    "REASSIGNMENT",
    "OPERATIONAL_NEED",
    "SPACE_OPTIMIZATION",
    "SECURITY_REQUIREMENT",
  ],
  STATUS_CHANGE: [
    "DAMAGED",
    "OBSOLETE",
    "LOSS",
    "THEFT",
    "END_OF_LIFE",
  ],
  RESTORE: [
    "REPAIR_COMPLETED",
    "ADMIN_ERROR",
    "FOUND",
    "LEGAL_REGULARIZATION",
  ],
};

const MOVEMENT_REASON_LABELS = {
  REASSIGNMENT: "Reasignacion operativa",
  OPERATIONAL_NEED: "Necesidad operativa",
  SPACE_OPTIMIZATION: "Optimizacion de espacio",
  SECURITY_REQUIREMENT: "Requerimiento de seguridad",
  DAMAGED: "Dano o deterioro",
  OBSOLETE: "Obsolescencia",
  LOSS: "Perdida",
  THEFT: "Robo",
  END_OF_LIFE: "Fin de vida util",
  REPAIR_COMPLETED: "Reparacion completada",
  ADMIN_ERROR: "Error administrativo",
  FOUND: "Recuperado/encontrado",
  LEGAL_REGULARIZATION: "Regularizacion legal",
};

module.exports = {
  MOVEMENT_REASON_CODES,
  MOVEMENT_REASON_LABELS,
};

