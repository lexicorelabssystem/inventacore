# Manual Operativo y Tecnico del Sistema de Inventario

## 1. Objetivo
Este manual define, de forma practica y completa:
- Como operar el sistema por rol (`ADMIN_CENTRAL`, `ADMIN_ESTABLISHMENT`, `VIEWER`).
- Como mantener y evolucionar el codigo sin romper funcionalidades.
- Como desplegar a nube en modo produccion (frontend + backend + base de datos).
- Como integrar PostgreSQL en Supabase con Prisma.

El enfoque es "de lo macro a lo micro": primero operacion y gobernanza, luego detalles tecnicos.

---

## 2. Vision General de Arquitectura
Componentes actuales:
- `frontend/`: SPA React (panel administrativo).
- `src/`: API Node.js + Express + Prisma.
- `prisma/`: esquema y migraciones.
- `docs/`: contratos funcionales, matrices y checklists.

Flujo base:
1. Usuario inicia sesion (`/auth/login`).
2. Frontend consume API protegida por JWT.
3. API valida rol/permisos y persiste en PostgreSQL via Prisma.
4. Se registra auditoria en movimientos y acciones administrativas.

Datos clave del dominio:
- Institucion -> Establecimiento -> Sector -> Activo Fijo.
- Movimientos de activo (`TRANSFER`, `STATUS_CHANGE`, `RESTORE`, `INVENTORY_CHECK`).
- Evidencias por movimiento sensible y facturas del bien.
- Catalogo de items para alta estandarizada.
- Cierres anuales de depreciacion al `31-12` con resumen historico de corridas.

---

## 3. Operacion por Rol

## 3.1 `ADMIN_CENTRAL`
Responsabilidades:
- Administrar instituciones, establecimientos, sectores y usuarios.
- Crear/editar/desactivar y reactivar entidades.
- Gestionar catalogo e importaciones masivas.
- Ver auditorias administrativas y de login.
- Ejecutar planchetas y reportes institucionales.

Buenas practicas:
- Usar importaciones para cargas grandes.
- Usar cambios manuales solo para correcciones puntuales.
- Revisar auditoria despues de cambios masivos.

## 3.2 `ADMIN_ESTABLISHMENT`
Responsabilidades:
- Operacion del inventario de su establecimiento.
- Alta de activos, transferencias internas permitidas, bajas/restauraciones.
- Carga y consulta de evidencias.
- Planchetas y reportes del establecimiento.

Limitaciones:
- No administra estructura global (instituciones).
- No opera fuera de su scope de establecimiento/institucion segun permisos.

## 3.3 `VIEWER`
Responsabilidades:
- Consulta de informacion y reportes.
- Sin permisos de escritura.

Limitaciones:
- Bloqueados endpoints de creacion/edicion/baja/restauracion/importacion.

---

## 4. Flujos Operativos Criticos (UI)

## 4.1 Crear Activo Fijo
Campos minimos obligatorios:
- `name`, `acquisitionValue`, `acquisitionDate`
- `assetTypeId`, `assetStateId`, `establishmentId`, `dependencyId`

Validaciones:
- Valores positivos (`acquisitionValue`, `quantity`).
- Fecha valida.
- Relaciones existentes y activas.

Comportamiento asistido:
- La vida util se sugiere automaticamente al seleccionar el item de catalogo.
- La fecha de inicio de depreciacion se prellena con la fecha de adquisicion si no se informa manualmente.

## 4.2 Transferir
Requiere:
- Destino (Sector destino, `toDependencyId`)
- `reasonCode` valido
- Evidencia obligatoria

Resultado:
- Movimiento registrado y trazabilidad completa.

## 4.3 Baja y Restauracion
Requiere:
- `reasonCode` de catalogo (no texto libre).
- Evidencia obligatoria.

Resultado:
- Cambio de estado + auditoria + historial del activo.
- En bajas, se emite un aviso contable automatico si existe correo configurado para contabilidad.
- La factura del bien se registra como evidencia `FACTURA` desde el mismo modulo de evidencias.

## 4.4 Importacion de Catalogo
Objetivo:
- Cargar o actualizar items catalogo por Excel.

Resultado esperado:
- Reporte `created/skipped/errors`.
- Dedupe por `officialKey` y/o clave compuesta.

## 4.5 Importacion de Activos
Objetivo:
- Alta masiva de activos con validaciones de negocio.

Resultado esperado:
- Sin errores 500.
- Reporte claro de errores por fila.
- Manejo robusto de conflictos de `internalCode`.

## 4.6 Cierre Anual de Depreciacion
Objetivo:
- Generar el cierre contable anual al `31-12` para una institucion.

Responsable:
- Solo `ADMIN_CENTRAL`.

Resultado esperado:
- Cierre creado con resumen por activo.
- Libro anual guardado en el sistema con corridas recientes visibles.
- Conflicto `409` si ya existe un cierre para el mismo año fiscal.
- Conflicto `409` si se intenta cerrar el año actual antes del `01-01` del año siguiente.

Buenas practicas:
- Ejecutar el cierre una sola vez por año fiscal.
- No cerrar el año actual antes de que comience el siguiente año calendario.
- Revisar antes el estado de `depreciationStartDate`, `usefulLifeYears` y `depreciationAnnualValue`.
- Usar el resumen de cierres recientes para auditar el ultimo proceso ejecutado.

---

## 5. API Operativa Minima (Resumen)
Auth:
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

Admin:
- `POST /admin/users`
- `GET /admin/users`
- `DELETE /admin/users/:id`
- `GET /admin/audit`
- `GET /admin/login-audit`

Activos:
- `POST /assets`
- `GET /assets`
- `POST /assets/depreciation/suggest`
- `GET /assets/depreciation/runs`
- `POST /assets/depreciation/runs/close`
- `PUT /assets/:id/transfer`
- `PUT /assets/:id/status`
- `PUT /assets/:id/restore`
- `GET /assets/:id/history`
- `POST /assets/:id/evidence`

Importaciones:
- `POST /admin/catalog-items/import/excel`
- `POST /assets/import/excel`

Planchetas:
- `GET /planchetas`
- `GET /planchetas/excel`
- `GET /planchetas/pdf`
- `GET /planchetas/compacta/excel`
- `GET /planchetas/compacta/pdf`
- `GET /planchetas/directorio/excel`
- `GET /planchetas/directorio/pdf`

La salida compacta elimina bloques graficos y prioriza una vista formal de una sola hoja para impresion.
Las planchetas incluyen una leyenda de responsabilidad del funcionario sobre el buen uso de los recursos asignados.

---

## 6. Guia Tecnica para Futuras Actualizaciones

## 6.1 Flujo de desarrollo recomendado
1. Crear rama por bloque funcional.
2. Implementar backend + frontend + test del caso.
3. Ejecutar pruebas locales:
   - `npm test`
   - `npm run test:smoke-admin`
   - `npm run test:asset-conflict`
4. Commit limpio por objetivo.
5. Validacion manual UI de flujo afectado.

## 6.2 Convenciones clave
- Errores de negocio: usar `code` estable (`409`/`400`) + `message` claro.
- Evitar exponer `dependency` como texto visible en UI.
- Mantener paridad UI/backend para validaciones criticas.
- Cualquier cambio de esquema: migracion Prisma + regenerar cliente.

## 6.3 Prisma y migraciones
Comandos base:
- `npx prisma migrate deploy`
- `npx prisma generate`

Regla:
- Nunca desplegar codigo nuevo sin aplicar migraciones de la misma version.

## 6.4 Control de calidad minimo obligatorio
- Flujo auth completo.
- CRUD usuarios con inactivos.
- Crear/transferir/baja/restaurar activos.
- Import catalogo y import assets.
- Cierre anual de depreciacion y consulta de corridas recientes.

---

## 7. Despliegue a Nube: Estrategias Recomendadas

## 7.1 Opcion A (recomendada para este proyecto)
- Backend API en Render o Railway.
- Frontend en Vercel (o Render Static Site).
- Base de datos PostgreSQL en Supabase.

Ventaja:
- Separacion clara frontend/backend.
- Escalado independiente.
- Menor acoplamiento en despliegues.

## 7.2 Opcion B (todo en un solo proveedor)
- Railway para API y frontend (o API + static).
- Supabase solo como base de datos.

Ventaja:
- Menos complejidad operativa inicial.

## 7.3 Opcion C
- API en Vercel (Express backend) + frontend en Vercel.
- DB en Supabase.

Nota:
- Funciona, pero debes revisar limites/timeout/concurrencia de tu plan para cargas intensivas.

---

## 8. Integrar Base de Datos Supabase con Prisma

## 8.1 Paso a paso
1. Crear proyecto Supabase.
2. Obtener cadena de conexion PostgreSQL.
3. Configurar `.env` del backend:
   - `DATABASE_URL=...`
4. Ejecutar:
   - `npx prisma migrate deploy`
   - `npx prisma generate`
5. Levantar API y probar `/health`.

## 8.2 Conexion recomendada segun entorno
- Entorno servidor tradicional: pooler session.
- Entorno serverless/autoscaling: pooler transaction.

## 8.3 Seguridad DB
- Usuario de aplicacion con privilegios minimos.
- Backups habilitados y verificados.
- Rotacion periodica de secretos.

---

## 9. Variables de Entorno Minimas (Produccion)
Backend:
- `NODE_ENV=production`
- `PORT`
- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGIN` (dominio frontend)

Frontend:
- `VITE_API_BASE` (URL publica del backend)

Opcionales utiles:
- `ACCOUNTING_NOTIFY_EMAIL` (correo para avisos de baja contable)

---

## 10. Checklist de Produccion (Go-Live)

## 10.1 Seguridad
- CORS restringido a dominio oficial.
- JWT secreto robusto.
- HTTPS forzado.
- Limites de rate limit activos.

## 10.2 Estabilidad
- Migraciones aplicadas.
- Cliente Prisma regenerado.
- Logs centralizados.
- Healthcheck y restart policy.

## 10.3 Calidad funcional
- Suite automatizada en verde.
- Revision manual de flujos criticos (crear/importar/transferir/baja/restaurar/evidencia).
- Auditorias y reportes operativos validados.

## 10.4 Entrega
- Tag de version estable.
- Runbook de incidentes actualizado.
- Manual operativo entregado a equipo funcional.

---

## 11. Runbook de Incidentes (resumen operativo)
Casos frecuentes:
- Error de migracion Prisma.
- Error de importacion masiva.
- Conflictos de unicidad (`internalCode`, `officialKey`).
- Error de permisos por rol/scope.

Accion base:
1. Revisar logs backend y `code` de respuesta.
2. Validar estado DB/migraciones.
3. Reproducir con endpoint puntual.
4. Aplicar fix + test + commit limpio.

---

## 12. Recomendacion de roadmap inmediato
1. Cerrar revision manual por rol (checklist de uso diario).
2. Definir politicas de respaldo y retencion de auditoria.
3. Incorporar monitoreo y alertas (errores 5xx, latencia, uso DB).
4. Preparar ambiente staging igual a produccion.
5. Ejecutar piloto con usuarios reales y retroalimentacion.

---

## 13. Referencias oficiales (despliegue y DB)
- Supabase + Prisma:
  - https://supabase.com/docs/guides/database/prisma
- Render (Express/Node deploy):
  - https://render.com/docs/deploy-node-express-app
  - https://render.com/docs/deploys
- Vercel (Express backend):
  - https://vercel.com/docs/frameworks/backend/express
  - https://vercel.com/docs/frameworks/backend
- Railway (deploy CLI):
  - https://docs.railway.com/cli/deploying
