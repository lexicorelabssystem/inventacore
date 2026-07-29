function formatClp(amount) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Number(amount || 0))
}

function DepreciationCloseView({
  isCentral,
  depreciationCloseForm,
  setDepreciationCloseForm,
  depreciationRuns,
  depreciationRunsLoading,
  depreciationClosing,
  onRefreshRuns,
  onCloseRun,
}) {
  const recentRuns = Array.isArray(depreciationRuns) ? depreciationRuns : []
  const latestRun = recentRuns[0] || null
  const fiscalYear = Number(depreciationCloseForm.fiscalYear)
  const closeBlockedByCalendar =
    Number.isInteger(fiscalYear) &&
    fiscalYear >= 2000 &&
    fiscalYear <= 2200 &&
    fiscalYear >= new Date().getFullYear()
      ? `El a\u00f1o ${fiscalYear} solo se puede cerrar desde el 01-01-${fiscalYear + 1}.`
      : ""

  return (
    <div className="form-card">
      <h4>Cierre anual de depreciacion</h4>
      <p className="muted">
        {`Genera el cierre al 31-12 del a\u00f1o elegido y registra el libro anual en el sistema.`}
      </p>

      {isCentral ? (
        <>
          <div className="field">
            <label>{"A\u00f1o"}</label>
            <input
              type="number"
              min="2000"
              max="2200"
              step="1"
              value={depreciationCloseForm.fiscalYear}
              onChange={(e) =>
                setDepreciationCloseForm((prev) => ({
                  ...prev,
                  fiscalYear: e.target.value,
                }))
              }
            />
          </div>
          <div className="actions">
            <button
              className="primary"
              onClick={onCloseRun}
              disabled={depreciationClosing || Boolean(closeBlockedByCalendar)}
            >
              {depreciationClosing ? "Cerrando..." : "Cerrar depreciacion"}
            </button>
            <button className="ghost" onClick={onRefreshRuns} disabled={depreciationRunsLoading}>
              {depreciationRunsLoading ? "Actualizando..." : "Refrescar cierres"}
            </button>
          </div>
          {closeBlockedByCalendar ? <p className="muted">{closeBlockedByCalendar}</p> : null}
        </>
      ) : (
        <p className="muted">
          Solo <strong>ADMIN_CENTRAL</strong> puede ejecutar el cierre anual de depreciacion.
        </p>
      )}

      {latestRun && (
        <div className="muted">
          <p>{`Ultimo cierre: ${latestRun.fiscalYear}`}</p>
          <p>{`Fecha de cierre: ${String(latestRun.closingDate || "").slice(0, 10)}`}</p>
          <p>{`Activos incluidos: ${latestRun.totalAssets || 0}`}</p>
          <p>{`Depreciacion total: ${formatClp(latestRun.totalAnnualDepreciation)}`}</p>
          <p>{`Valor libro final: ${formatClp(latestRun.totalClosingBookValue)}`}</p>
          <p>{`Cerrado por: ${latestRun.closedBy?.name || latestRun.closedBy?.email || "N/D"}`}</p>
        </div>
      )}

      <div className="table" style={{ marginTop: 12 }}>
        <div className="table-head">
          <h4>Cierres recientes</h4>
          <span className="muted">
            {depreciationRunsLoading ? "Cargando..." : `Mostrando ${recentRuns.length}`}
          </span>
        </div>
        {recentRuns.length ? (
          recentRuns.map((run) => (
            <div key={run.id} className="row">
              <div className="row-main">
                <strong>{run.fiscalYear}</strong>
                <span className="pill">{String(run.closingDate || "").slice(0, 10)}</span>
                <span className="pill">Activos: {run.totalAssets || 0}</span>
                <span className="pill">{formatClp(run.totalAnnualDepreciation)}</span>
                <span className="pill">{formatClp(run.totalClosingBookValue)}</span>
                <span className="pill">
                  {run.closedBy?.name || run.closedBy?.email || "Usuario eliminado"}
                </span>
              </div>
            </div>
          ))
        ) : (
          <p className="muted">Aun no se han generado cierres de depreciacion.</p>
        )}
      </div>
    </div>
  )
}

export default DepreciationCloseView
