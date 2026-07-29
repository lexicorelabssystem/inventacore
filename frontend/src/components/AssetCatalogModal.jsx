import { UI_TEXT } from '../constants/uiText'

function AssetCatalogModal(props) {
  const {
    isOpen,
    onClose,
    modalCatalogItem,
    createdAsset,
    createdLabel,
    qrCodeUrl,
    status,
    copyStatusDetailsJson,
    copyTechnicalSheetLink,
    openPrintLabel,
    openCatalogAction,
    isCentral,
    catalogAction,
    setCatalogAction,
    editAssetForm,
    setEditAssetForm,
    editAssetHasResponsible,
    setEditAssetHasResponsible,
    normalizeRutValue,
    normalizeCostCenterValue,
    submitEditAsset,
    moveAssetForm,
    setMoveAssetForm,
    assetDependencies,
    submitMoveAsset,
    transferAssetForm,
    setTransferAssetForm,
    transferEstablishments,
    transferDependencies,
    loadTransferDependenciesForEstablishment,
    setErr,
    movementReasonCodes,
    submitTransferAsset,
    statusAssetForm,
    setStatusAssetForm,
    assetStates,
    submitStatusAsset,
    assetEvidenceMovements,
    evidenceForm,
    setEvidenceForm,
    prepareEvidenceDocType,
    submitEvidenceUpload,
    assetEvidenceLoading,
    assetEvidence,
    downloadEvidence,
    assetHistoryLoading,
    assetMovements,
    getMovementTitle,
    getMovementRouteLabel,
    getMovementReasonLabel,
    isActaEligibleMovement,
    openMovementActa,
    prepareEvidenceForMovement,
  } = props

  const hasModalContext = Boolean(createdAsset || modalCatalogItem)
  const isBaja = Boolean(createdAsset?.isDeleted) || createdAsset?.assetState?.name === 'BAJA'

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h4>{modalCatalogItem ? 'Detalle del catalogo' : 'Detalle del activo fijo'}</h4>
          <button className="ghost" onClick={onClose}>
            Cerrar
          </button>
        </div>
        {hasModalContext ? (
          <div className="modal-body">
            <div className="modal-layout">
              <div className="modal-main">
                <div className="modal-grid">
                  <div>
                    <strong>Nombre</strong>
                    <span>{modalCatalogItem?.name || createdAsset?.name || '-'}</span>
                  </div>
                  <div>
                    <strong>Categoria</strong>
                    <span>{modalCatalogItem?.category || '-'}</span>
                  </div>
                  <div>
                    <strong>Subcategoria</strong>
                    <span>{modalCatalogItem?.subcategory || '-'}</span>
                  </div>
                  <div>
                    <strong>Marca</strong>
                    <span>{modalCatalogItem?.brand || createdAsset?.brand || '-'}</span>
                  </div>
                  <div>
                    <strong>Modelo</strong>
                    <span>{modalCatalogItem?.modelName || createdAsset?.modelName || '-'}</span>
                  </div>
                  <div>
                    <strong>Vida util</strong>
                    <span>
                      {createdAsset?.usefulLifeYears
                        ? `${createdAsset.usefulLifeYears} años`
                        : modalCatalogItem
                          ? 'Sugerida al crear'
                          : '-'}
                    </span>
                  </div>
                  <div>
                    <strong>Inicio depreciacion</strong>
                    <span>
                      {createdAsset?.depreciationStartDate
                        ? String(createdAsset.depreciationStartDate).slice(0, 10)
                        : createdAsset?.acquisitionDate
                          ? String(createdAsset.acquisitionDate).slice(0, 10)
                          : '-'}
                    </span>
                  </div>
                </div>
                {!modalCatalogItem && (
                  <p className="muted">
                    Este activo fijo no tiene item de catalogo asociado; puedes operar igual.
                  </p>
                )}
                {status?.details && (
                  <button
                    type="button"
                    className="ghost status-copy-btn"
                    onClick={copyStatusDetailsJson}
                  >
                    Copiar detalle JSON
                  </button>
                )}
                {createdLabel ? (
                  <div className="modal-label">
                    <div className="label-code">
                      Codigo: <strong>{createdLabel.code}</strong>
                    </div>
                    {qrCodeUrl && <img className="qr" src={qrCodeUrl} alt="QR" />}
                    <div className="actions">
                      <a
                        className="ghost"
                        href={createdLabel.technicalSheetUrl || '#'}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ver ficha tecnica HTML
                      </a>
                      <button className="ghost" onClick={copyTechnicalSheetLink}>
                        Copiar link ficha
                      </button>
                      <button className="ghost" onClick={openPrintLabel}>
                        Imprimir etiqueta
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="muted">
                      Para ver QR e imprimir etiqueta necesitas crear el activo fijo.
                    </p>
                    <div className="actions">
                      <button className="ghost" disabled>
                        Ver ficha tecnica HTML
                      </button>
                      <button className="ghost" disabled>
                        Copiar link ficha
                      </button>
                      <button className="ghost" disabled>
                        Imprimir etiqueta
                      </button>
                    </div>
                  </>
                )}
              </div>
              <div className="modal-side">
                <div className="modal-actions">
                  <button
                    className="ghost"
                    disabled={!createdLabel}
                    onClick={() => openCatalogAction('edit')}
                  >
                    Editar activo fijo
                  </button>
                  <button
                    className="ghost"
                    disabled={!createdLabel}
                    onClick={() => openCatalogAction('move')}
                  >
                    Mover activo fijo
                  </button>
                  <button
                    className="ghost"
                    disabled={!createdLabel || !isCentral || isBaja}
                    onClick={() => openCatalogAction('transfer')}
                  >
                    Transferir
                  </button>
                  <button
                    className="danger"
                    disabled={!createdLabel || isBaja}
                    onClick={() => openCatalogAction('status')}
                  >
                    Dar de baja
                  </button>
                </div>
                {catalogAction === 'edit' && (
                  <div className="modal-form">
                    <h5>Editar activo fijo</h5>
                    <div className="modal-grid">
                      <div>
                        <strong>Nombre</strong>
                        <input
                          value={editAssetForm.name}
                          onChange={(e) =>
                            setEditAssetForm((p) => ({ ...p, name: e.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <strong>Marca</strong>
                        <input
                          value={editAssetForm.brand}
                          onChange={(e) =>
                            setEditAssetForm((p) => ({ ...p, brand: e.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <strong>Modelo</strong>
                        <input
                          value={editAssetForm.modelName}
                          onChange={(e) =>
                            setEditAssetForm((p) => ({
                              ...p,
                              modelName: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <strong>Serie</strong>
                        <input
                          value={editAssetForm.serialNumber}
                          onChange={(e) =>
                            setEditAssetForm((p) => ({
                              ...p,
                              serialNumber: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <strong>Cantidad</strong>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={editAssetForm.quantity}
                          onChange={(e) =>
                            setEditAssetForm((p) => ({
                              ...p,
                              quantity: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <strong>Cuenta contable</strong>
                        <input
                          value={editAssetForm.accountingAccount}
                          onChange={(e) =>
                            setEditAssetForm((p) => ({
                              ...p,
                              accountingAccount: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <strong>Codigo analitico</strong>
                        <input
                          value={editAssetForm.analyticCode}
                          onChange={(e) =>
                            setEditAssetForm((p) => ({
                              ...p,
                              analyticCode: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <label className="inline-check">
                        <input
                          type="checkbox"
                          checked={!editAssetHasResponsible}
                          onChange={(e) => {
                            const withoutResponsible = e.target.checked
                            setEditAssetHasResponsible(!withoutResponsible)
                            if (withoutResponsible) {
                              setEditAssetForm((p) => ({
                                ...p,
                                responsibleName: '',
                                responsibleRut: '',
                                responsibleRole: '',
                                costCenter: '',
                              }))
                            }
                          }}
                        />
                        Sin responsable asignado
                      </label>
                      {editAssetHasResponsible ? (
                        <>
                          <div>
                            <strong>Responsable</strong>
                            <input
                              value={editAssetForm.responsibleName}
                              onChange={(e) =>
                                setEditAssetForm((p) => ({
                                  ...p,
                                  responsibleName: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div>
                            <strong>RUT responsable</strong>
                            <input
                              value={editAssetForm.responsibleRut}
                              onChange={(e) =>
                                setEditAssetForm((p) => ({
                                  ...p,
                                  responsibleRut: e.target.value,
                                }))
                              }
                              onBlur={(e) =>
                                setEditAssetForm((p) => ({
                                  ...p,
                                  responsibleRut: normalizeRutValue(e.target.value),
                                }))
                              }
                            />
                          </div>
                          <div>
                            <strong>Cargo responsable</strong>
                            <input
                              value={editAssetForm.responsibleRole}
                              onChange={(e) =>
                                setEditAssetForm((p) => ({
                                  ...p,
                                  responsibleRole: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div>
                            <strong>Centro de costo</strong>
                            <input
                              value={editAssetForm.costCenter}
                              onChange={(e) =>
                                setEditAssetForm((p) => ({
                                  ...p,
                                  costCenter: e.target.value,
                                }))
                              }
                              onBlur={(e) =>
                                setEditAssetForm((p) => ({
                                  ...p,
                                  costCenter: normalizeCostCenterValue(e.target.value),
                                }))
                              }
                            />
                          </div>
                        </>
                      ) : (
                        <p className="muted">El activo fijo quedara sin responsable.</p>
                      )}
                      <div>
                        <strong>Valor de adquisicion</strong>
                        <input
                          type="number"
                          value={editAssetForm.acquisitionValue}
                          onChange={(e) =>
                            setEditAssetForm((p) => ({
                              ...p,
                              acquisitionValue: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <strong>Fecha de adquisicion</strong>
                        <input
                          type="date"
                          value={editAssetForm.acquisitionDate}
                          onChange={(e) =>
                            setEditAssetForm((p) => ({
                              ...p,
                              acquisitionDate: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="actions">
                      <button className="ghost" onClick={() => setCatalogAction(null)}>
                        Cancelar
                      </button>
                      <button className="primary" onClick={submitEditAsset}>
                        {UI_TEXT.saveChanges}
                      </button>
                    </div>
                  </div>
                )}
                {catalogAction === 'move' && (
                  <div className="modal-form">
                    <h5>Mover activo fijo</h5>
                    <div className="modal-grid">
                      <div>
                        <strong>Establecimiento actual</strong>
                        <span>{createdAsset?.establishment?.name || '-'}</span>
                      </div>
                      <div>
                        <strong>Sector actual</strong>
                        <span>{createdAsset?.dependency?.name || '-'}</span>
                      </div>
                    </div>
                    <div className="modal-grid">
                      <div>
                        <strong>Sector destino</strong>
                        <select
                          value={moveAssetForm.toDependencyId}
                          onChange={(e) => setMoveAssetForm({ toDependencyId: e.target.value })}
                        >
                          <option value="">Selecciona sector</option>
                          {assetDependencies.map((dep) => (
                            <option key={dep.id} value={dep.id}>
                              {dep.name}
                            </option>
                          ))}
                        </select>
                        {!assetDependencies.length && (
                          <p className="muted">
                            No hay sectores disponibles para este establecimiento.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="actions">
                      <button className="ghost" onClick={() => setCatalogAction(null)}>
                        Cancelar
                      </button>
                      <button className="primary" onClick={submitMoveAsset}>
                        Mover
                      </button>
                    </div>
                  </div>
                )}
                {catalogAction === 'transfer' && (
                  <div className="modal-form">
                    <h5>Transferir activo fijo</h5>
                    <div className="modal-grid">
                      <div>
                        <strong>Establecimiento destino</strong>
                        <select
                          value={transferAssetForm.toEstablishmentId}
                          onChange={(e) => {
                            const value = e.target.value
                            setTransferAssetForm((prev) => ({
                              ...prev,
                              toEstablishmentId: value,
                              toDependencyId: '',
                            }))
                            loadTransferDependenciesForEstablishment(value).catch((err) =>
                              setErr(err)
                            )
                          }}
                        >
                          <option value="">Selecciona establecimiento</option>
                          {transferEstablishments.map((est) => (
                            <option key={est.id} value={est.id}>
                              {est.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <strong>Sector destino</strong>
                        <select
                          value={transferAssetForm.toDependencyId}
                          onChange={(e) =>
                            setTransferAssetForm((prev) => ({
                              ...prev,
                              toDependencyId: e.target.value,
                            }))
                          }
                          disabled={!transferAssetForm.toEstablishmentId}
                        >
                          <option value="">Selecciona sector</option>
                          {transferDependencies.map((dep) => (
                            <option key={dep.id} value={dep.id}>
                              {dep.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <strong>Motivo</strong>
                        <select
                          value={transferAssetForm.reasonCode}
                          onChange={(e) =>
                            setTransferAssetForm((prev) => ({
                              ...prev,
                              reasonCode: e.target.value,
                            }))
                          }
                        >
                          <option value="">Selecciona motivo</option>
                          {(movementReasonCodes.transfer || []).map((item) => (
                            <option key={item.code} value={item.code}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <strong>Tipo documento</strong>
                        <select
                          value={transferAssetForm.docType}
                          onChange={(e) =>
                            setTransferAssetForm((prev) => ({
                              ...prev,
                              docType: e.target.value,
                            }))
                          }
                        >
                          <option value="FOTO">FOTO</option>
                          <option value="ACTA">ACTA</option>
                          <option value="FACTURA">FACTURA</option>
                          <option value="OTRO">OTRO</option>
                        </select>
                      </div>
                      <div>
                        <strong>Nota evidencia</strong>
                        <input
                          value={transferAssetForm.note}
                          onChange={(e) =>
                            setTransferAssetForm((prev) => ({
                              ...prev,
                              note: e.target.value,
                            }))
                          }
                          placeholder={UI_TEXT.noteShort}
                        />
                      </div>
                      <div>
                        <strong>Archivo (PDF/JPG/PNG)</strong>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={(e) =>
                            setTransferAssetForm((prev) => ({
                              ...prev,
                              file: e.target.files?.[0] || null,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="actions">
                      <button className="ghost" onClick={() => setCatalogAction(null)}>
                        Cancelar
                      </button>
                      <button className="primary" onClick={submitTransferAsset}>
                        Confirmar transferencia
                      </button>
                    </div>
                  </div>
                )}
                {catalogAction === 'status' && (
                  <div className="modal-form">
                    <h5>Dar de baja</h5>
                    <div className="modal-grid">
                      <div>
                        <strong>Estado</strong>
                        <select
                          value={statusAssetForm.assetStateId}
                          onChange={(e) =>
                            setStatusAssetForm((prev) => ({
                              ...prev,
                              assetStateId: e.target.value,
                            }))
                          }
                        >
                          <option value="">Selecciona estado</option>
                          {assetStates.map((st) => (
                            <option key={st.id} value={st.id}>
                              {st.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <strong>Motivo</strong>
                        <select
                          value={statusAssetForm.reasonCode}
                          onChange={(e) =>
                            setStatusAssetForm((prev) => ({
                              ...prev,
                              reasonCode: e.target.value,
                            }))
                          }
                        >
                          <option value="">Selecciona motivo</option>
                          {(movementReasonCodes.statusChange || []).map((item) => (
                            <option key={item.code} value={item.code}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <strong>Tipo documento</strong>
                        <select
                          value={statusAssetForm.docType}
                          onChange={(e) =>
                            setStatusAssetForm((prev) => ({
                              ...prev,
                              docType: e.target.value,
                            }))
                          }
                        >
                          <option value="FOTO">FOTO</option>
                          <option value="ACTA">ACTA</option>
                          <option value="FACTURA">FACTURA</option>
                          <option value="OTRO">OTRO</option>
                        </select>
                      </div>
                      <div>
                        <strong>Nota evidencia</strong>
                        <input
                          value={statusAssetForm.note}
                          onChange={(e) =>
                            setStatusAssetForm((prev) => ({
                              ...prev,
                              note: e.target.value,
                            }))
                          }
                          placeholder={UI_TEXT.noteShort}
                        />
                      </div>
                      <div>
                        <strong>Archivo (PDF/JPG/PNG)</strong>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={(e) =>
                            setStatusAssetForm((prev) => ({
                              ...prev,
                              file: e.target.files?.[0] || null,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="actions">
                      <button className="ghost" onClick={() => setCatalogAction(null)}>
                        Cancelar
                      </button>
                      <button className="danger" onClick={submitStatusAsset}>
                        Confirmar baja
                      </button>
                    </div>
                  </div>
                )}
                {createdLabel && (
                  <div className="modal-form" id="asset-evidence-section">
                    <h5>Evidencias y factura</h5>
                    <p className="muted">
                      Genera el acta desde el historial, imprimela para firma y luego sube la
                      version escaneada como evidencia ACTA vinculada al movimiento. Si necesitas
                      registrar la factura del bien, usa el tipo FACTURA en el mismo formulario.
                    </p>
                    <div className="actions">
                      <button className="ghost" onClick={() => prepareEvidenceDocType('ACTA')}>
                        Preparar acta
                      </button>
                      <button className="ghost" onClick={() => prepareEvidenceDocType('FACTURA')}>
                        Preparar factura
                      </button>
                    </div>
                    <div className="modal-grid">
                      <div>
                        <strong>Movimiento sensible</strong>
                        <select
                          value={evidenceForm.movementId}
                          onChange={(e) =>
                            setEvidenceForm((prev) => ({
                              ...prev,
                              movementId: e.target.value,
                            }))
                          }
                        >
                          <option value="">Sin movimiento especifico</option>
                          {assetEvidenceMovements.map((m) => (
                            <option key={m.id} value={m.id}>
                              #{m.id} - {getMovementTitle(m)} - {getMovementReasonLabel(m)} -{' '}
                              {new Date(m.createdAt).toLocaleString()}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <strong>Tipo documento</strong>
                        <select
                          value={evidenceForm.docType}
                          onChange={(e) =>
                            setEvidenceForm((prev) => ({
                              ...prev,
                              docType: e.target.value,
                            }))
                          }
                        >
                          <option value="FOTO">FOTO</option>
                          <option value="ACTA">ACTA</option>
                          <option value="FACTURA">FACTURA</option>
                          <option value="OTRO">OTRO</option>
                        </select>
                      </div>
                      <div>
                        <strong>Nota</strong>
                        <input
                          value={evidenceForm.note}
                          onChange={(e) =>
                            setEvidenceForm((prev) => ({
                              ...prev,
                              note: e.target.value,
                            }))
                          }
                          placeholder={UI_TEXT.noteShort}
                        />
                      </div>
                      <div>
                        <strong>Archivo (PDF/JPG/PNG)</strong>
                        <input
                          id="evidence-file-input"
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={(e) =>
                            setEvidenceForm((prev) => ({
                              ...prev,
                              file: e.target.files?.[0] || null,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="actions">
                      <button className="primary" onClick={submitEvidenceUpload}>
                        Subir evidencia
                      </button>
                    </div>
                    <div className="table-wrap">
                      {assetEvidenceLoading ? (
                        <p className="muted">Cargando evidencias...</p>
                      ) : assetEvidence.length ? (
                        <table>
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Tipo</th>
                              <th>Movimiento</th>
                              <th>Archivo</th>
                              <th>Fecha</th>
                              <th>{UI_TEXT.action}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {assetEvidence.map((ev) => (
                              <tr key={ev.id}>
                                <td>{ev.id}</td>
                                <td>{ev.docType}</td>
                                <td>{ev.movementId || '-'}</td>
                                <td>{ev.fileName}</td>
                                <td>{new Date(ev.createdAt).toLocaleString()}</td>
                                <td>
                                  <button className="ghost" onClick={() => downloadEvidence(ev)}>
                                    Descargar
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="muted">Sin evidencias cargadas.</p>
                      )}
                    </div>
                  </div>
                )}
                {createdLabel && (
                  <div className="modal-form" id="asset-history-section">
                    <h5>Historial del bien</h5>
                    <p className="muted">
                      Aqui veras las asignaciones, transferencias, bajas y devoluciones. Cada
                      movimiento con acta disponible para impresion y posterior archivo como
                      evidencia firmada.
                    </p>
                    <div className="table-wrap">
                      {assetHistoryLoading ? (
                        <p className="muted">Cargando historial...</p>
                      ) : assetMovements.length ? (
                        <table>
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Fecha</th>
                              <th>Evento</th>
                              <th>Ruta</th>
                              <th>Motivo</th>
                              <th>Usuario</th>
                              <th>Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {assetMovements.map((movement) => (
                              <tr key={movement.id}>
                                <td>{movement.id}</td>
                                <td>{new Date(movement.createdAt).toLocaleString()}</td>
                                <td>{getMovementTitle(movement)}</td>
                                <td>{getMovementRouteLabel(movement)}</td>
                                <td>{getMovementReasonLabel(movement)}</td>
                                <td>{movement.user?.name || movement.user?.email || '-'}</td>
                                <td>
                                  <div className="actions">
                                    <button
                                      className="ghost"
                                      disabled={!isActaEligibleMovement(movement)}
                                      onClick={() => openMovementActa(movement)}
                                    >
                                      Imprimir acta
                                    </button>
                                    <button
                                      className="primary"
                                      disabled={!isActaEligibleMovement(movement)}
                                      onClick={() => prepareEvidenceForMovement(movement)}
                                    >
                                      Adjuntar firmada
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="muted">Sin movimientos registrados para este activo.</p>
                      )}
                    </div>
                  </div>
                )}
                <div className="modal-help">
                  <strong>Como usar</strong>
                  <p>1. Crea el activo fijo para habilitar QR y acciones.</p>
                  <p>2. Usa Editar para cambiar datos.</p>
                  <p>3. Dar de baja lo envia al Basurero.</p>
                  <p>4. Desde Historial puedes imprimir el acta y luego adjuntar la firmada.</p>
                </div>
              </div>
            </div>
            <div className="actions">
              <button className="primary" onClick={onClose}>
                Continuar con el formulario
              </button>
            </div>
          </div>
        ) : (
          <p className="muted">{`Sin datos de ${UI_TEXT.catalog.toLowerCase()}.`}</p>
        )}
      </div>
    </div>
  )
}

export default AssetCatalogModal
