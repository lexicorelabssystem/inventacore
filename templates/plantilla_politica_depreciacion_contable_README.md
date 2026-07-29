# Plantilla politica depreciacion contable

Usa este archivo para que Contabilidad defina las reglas oficiales de depreciacion por cuenta.

## Campos
- `cuenta_contable`: Codigo de la cuenta contable (obligatorio).
- `nombre_cuenta`: Nombre de la cuenta (obligatorio).
- `categoria_activo`: Categoria funcional (opcional, recomendado).
- `subcategoria_activo`: Subcategoria (opcional).
- `vida_util_anios`: Vida util en anos (obligatorio, entero mayor a 0).
- `tasa_depreciacion_anual_pct`: Porcentaje anual (obligatorio, mayor a 0). Idealmente `100 / vida_util_anios`.
- `metodo_depreciacion`: Ejemplo `LINEAL` (obligatorio).
- `valor_residual_pct`: Porcentaje residual (obligatorio, puede ser `0`).
- `aplica_desde`: Fecha de vigencia en formato `YYYY-MM-DD` (obligatorio).
- `observaciones`: Comentarios de control (opcional).
- `estado`: `VIGENTE` o `INACTIVA` (obligatorio).

## Reglas recomendadas de validacion
- No repetir `cuenta_contable` + `aplica_desde`.
- Mantener una sola fila `VIGENTE` por cuenta y periodo.
- Si `metodo_depreciacion` es `LINEAL`, validar coherencia entre vida util y tasa.

## Flujo recomendado
1. Contabilidad completa y valida la plantilla.
2. TI importa la tabla al sistema.
3. El sistema usa esa tabla como prioridad sobre reglas por nombre/categoria.
