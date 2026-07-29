export const UI_STATUS = {
  catalogBulkImportCompleted: 'Carga masiva de cat\u00e1logo completada.',
  dependencyDeactivated: 'Sector dado de baja.',
  dependencyDeleted: 'Sector eliminado definitivamente.',
  dependencyReactivated: 'Sector reactivado.',
  dependencyUpdated: 'Sector actualizado.',
  forceDeleteCompleted: 'Eliminaci\u00f3n forzada completada.',
  importCompleted: 'Importaci\u00f3n completada.',
  institutionDeactivated: 'Instituci\u00f3n dada de baja.',
  institutionDeleted: 'Instituci\u00f3n eliminada definitivamente.',
  institutionReactivated: 'Instituci\u00f3n reactivada.',
  institutionUpdated: 'Instituci\u00f3n actualizada.',
  photoUpdated: 'Foto de usuario actualizada.',
  sessionClosed: 'Sesi\u00f3n cerrada.',
  sessionStarted: 'Sesi\u00f3n iniciada correctamente.',
}

export const UI_ERROR = {
  couldNotClear: (target) => `No se pudo vaciar ${target}.`,
  couldNotComplete: (target) => `No se pudo completar ${target}.`,
  couldNotDeactivate: (target) => `No se pudo dar de baja ${target}.`,
  couldNotDeletePermanently: (target) => `No se pudo eliminar definitivamente ${target}.`,
  couldNotLoad: (target) => `No se pudo cargar ${target}.`,
  couldNotReactivate: (target) => `No se pudo reactivar ${target}.`,
}

export const UI_SUCCESS = {
  assetRestored: (name) => `Activo fijo restaurado: ${name}`,
  catalogItemUpdated: (id) => `\u00cdtem #${id} actualizado.`,
  dependencyCreated: (name) => `Sector creado: ${name}`,
  establishmentCreated: (name) => `Establecimiento creado: ${name}`,
  institutionCreated: (name) => `Instituci\u00f3n creada: ${name}`,
  userCreated: (email) => `Usuario creado: ${email}`,
  userDeactivated: (email) => `Usuario desactivado: ${email}`,
  userReactivated: (email) => `Usuario reactivado: ${email}`,
  userUpdated: (email) => `Usuario actualizado: ${email}`,
}
