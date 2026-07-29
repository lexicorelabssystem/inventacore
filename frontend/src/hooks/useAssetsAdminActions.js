import { UI_SUCCESS } from '../constants/uiMessages'

function useAssetsAdminActions({
  api,
  apiMultipart,
  apiText,
  downloadFile,
  setErr,
  setOk,
  isCentral,
  withMappedError,
  getAssetCreateConflictMessage,
  getMoveConflictMessage,
  toPositiveIntOrNull,
  getSafeAssetId,
  validateAssetForm,
  normalizeRutValue,
  normalizeCostCenterValue,
  calculateStraightLineDepreciation,
  loadAssetDependencies,
  loadTransferEstablishmentsForAsset,
  loadAssetStates,
  loadMovementReasonCodes,
  loadAssetsList,
  loadAssetEvidence,
  loadTrash,
  assetForm,
  assetHasResponsible,
  assetMultiProductEnabled,
  assetMultiProducts,
  createdAsset,
  editAssetForm,
  editAssetHasResponsible,
  moveAssetForm,
  transferAssetForm,
  statusAssetForm,
  evidenceForm,
  movementReasonCodes,
  restoreModal,
  assetStates,
  setAssetCreating,
  setAssetErrors,
  setCreatedAsset,
  setCreatedAssetBatch,
  setEditAssetForm,
  setMoveAssetForm,
  setTransferAssetForm,
  setTransferDependencies,
  setStatusAssetForm,
  setEditAssetHasResponsible,
  setEvidenceForm,
  setRestoreModal,
  setSelectedCatalogItem,
  setCatalogModalOpen,
  setCatalogAction,
  setAssetDependencies,
}) {
  async function submitEvidenceUpload() {
    const assetId = getSafeAssetId(createdAsset)
    if (!assetId) {
      setErr('Activo fijo invalido para subir evidencia.')
      return
    }
    if (!evidenceForm.file) {
      setErr('Selecciona un archivo de evidencia.')
      return
    }
    if (!evidenceForm.docType) {
      setErr('Selecciona tipo de documento.')
      return
    }

    try {
      const formData = new FormData()
      formData.append('docType', evidenceForm.docType)
      if (evidenceForm.note?.trim()) formData.append('note', evidenceForm.note.trim())
      if (evidenceForm.movementId) formData.append('movementId', evidenceForm.movementId)
      formData.append('file', evidenceForm.file)

      await apiMultipart(`/assets/${assetId}/evidence`, {
        method: 'POST',
        formData,
      })
      setEvidenceForm((prev) => ({
        ...prev,
        note: '',
        file: null,
      }))
      const fileInput = document.getElementById('evidence-file-input')
      if (fileInput) fileInput.value = ''
      await loadAssetEvidence(assetId)
      setOk('Evidencia subida correctamente.')
    } catch (err) {
      setErr(err)
    }
  }

  function prepareEvidenceDocType(docType) {
    setEvidenceForm((prev) => ({
      ...prev,
      docType,
      movementId: docType === 'FACTURA' ? '' : prev.movementId,
    }))
  }

  async function downloadEvidence(item) {
    const assetId = getSafeAssetId(createdAsset)
    const evidenceId = toPositiveIntOrNull(item?.id)
    if (!assetId || !evidenceId) return
    try {
      await downloadFile(
        `/assets/${assetId}/evidence/${evidenceId}/download`,
        item.fileName || `evidence_${item.id}`
      )
    } catch (err) {
      setErr(err)
    }
  }

  function getMovementReasonLabel(movement) {
    const code = String(movement?.reasonCode || '').trim()
    if (!code) return 'Sin motivo'
    const catalog = [
      ...(movementReasonCodes.transfer || []),
      ...(movementReasonCodes.statusChange || []),
      ...(movementReasonCodes.restore || []),
    ]
    return catalog.find((item) => item.code === code)?.label || code
  }

  function getMovementTitle(movement) {
    if (!movement) return 'Movimiento'
    if (movement.type === 'TRANSFER') return 'Transferencia'
    if (movement.type === 'RELOCATION') return 'Reasignacion interna'
    if (movement.type === 'INVENTORY_CHECK') return 'Registro inicial'
    if (movement.type === 'STATUS_CHANGE') {
      const restoreCodes = movementReasonCodes.restore || []
      if (restoreCodes.some((item) => item.code === movement.reasonCode)) {
        return 'Devolucion'
      }
      return 'Cambio de estado'
    }
    return movement.type || 'Movimiento'
  }

  function getMovementActaTitle(movement) {
    if (!movement) return 'Acta de movimiento'
    if (movement.type === 'TRANSFER') return 'Acta de entrega'
    if (movement.type === 'RELOCATION') return 'Acta de reasignacion interna'
    if (movement.type === 'INVENTORY_CHECK') return 'Acta de verificacion inicial'
    if (movement.type === 'STATUS_CHANGE') {
      const restoreCodes = movementReasonCodes.restore || []
      if (restoreCodes.some((item) => item.code === movement.reasonCode)) {
        return 'Acta de devolucion'
      }
      return 'Acta de baja'
    }
    return 'Acta de movimiento'
  }

  function getMovementRouteLabel(movement) {
    const from = movement?.fromDependency?.name || createdAsset?.dependency?.name || '-'
    const to = movement?.toDependency?.name || from
    return `${from} -> ${to}`
  }

  function isActaEligibleMovement(movement) {
    if (!movement) return false
    if (movement.type === 'TRANSFER' || movement.type === 'RELOCATION') return true
    if (movement.type === 'INVENTORY_CHECK') return true
    if (movement.type === 'STATUS_CHANGE') return true
    return false
  }

  function prepareEvidenceForMovement(movement) {
    const movementId = toPositiveIntOrNull(movement?.id)
    if (!movementId) return
    const actaTitle = getMovementActaTitle(movement)
    setEvidenceForm((prev) => ({
      ...prev,
      movementId: String(movementId),
      docType: 'ACTA',
      note: `Acta firmada del movimiento #${movementId}`,
    }))
    const target = document.getElementById('asset-evidence-section')
    if (target?.scrollIntoView) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    setOk(`${actaTitle} del movimiento #${movementId} preparada para adjuntar.`)
  }

  async function openMovementActa(movement) {
    const assetId = getSafeAssetId(createdAsset)
    const movementId = toPositiveIntOrNull(movement?.id)
    if (!assetId || !movementId) {
      setErr('No se pudo preparar el acta del movimiento.')
      return
    }

    const win = window.open('', '_blank', 'width=980,height=1200')
    if (!win) {
      setErr('El navegador bloqueo la ventana de impresion.')
      return
    }

    try {
      const html = await apiText(`/assets/${assetId}/movements/${movementId}/acta`)
      win.document.open()
      win.document.write(html)
      win.document.close()
    } catch (err) {
      try {
        win.close()
      } catch {
        // ignore
      }
      setErr(err)
    }
  }

  function restoreFromTrash(asset) {
    const restoreCodes = movementReasonCodes.restore || []
    if (!restoreCodes.length) {
      setErr('No hay catalogo de motivos de restauracion disponible.')
      return
    }
    setRestoreModal({
      open: true,
      asset,
      reasonCode: restoreCodes[0]?.code || '',
      docType: 'ACTA',
      note: '',
      file: null,
    })
  }

  async function confirmRestoreFromTrash() {
    const restoreAssetId = getSafeAssetId(restoreModal.asset)
    if (!restoreAssetId) {
      setErr('Activo fijo invalido para restaurar.')
      return
    }
    if (!restoreModal.reasonCode) {
      setErr('Selecciona un motivo de restauracion.')
      return
    }
    if (!restoreModal.file) {
      setErr('Adjunta evidencia (PDF/JPG/PNG) para restaurar.')
      return
    }
    try {
      const formData = new FormData()
      formData.append('reasonCode', restoreModal.reasonCode)
      formData.append('docType', restoreModal.docType)
      if (restoreModal.note) formData.append('note', restoreModal.note)
      formData.append('file', restoreModal.file)
      await apiMultipart(`/assets/${restoreAssetId}/restore`, {
        method: 'PUT',
        formData,
      })
      setOk(UI_SUCCESS.assetRestored(restoreModal.asset.name))
      setRestoreModal({
        open: false,
        asset: null,
        reasonCode: '',
        docType: 'ACTA',
        note: '',
        file: null,
      })
      await loadTrash()
      await loadAssetsList()
    } catch (err) {
      if (err?.status === 409) {
        await loadTrash()
        await loadAssetsList()
      }
      setErr(err)
    }
  }

  async function handleCreateAsset() {
    setAssetCreating(true)
    try {
      const errors = validateAssetForm()
      setAssetErrors(errors)
      if (Object.keys(errors).length) {
        setAssetCreating(false)
        return
      }
      const useMultiProduct = assetMultiProductEnabled
      const requestedQuantity = Number(assetForm.quantity)
      const serialValue = String(assetForm.serialNumber || '').trim()
      const basePayload = {
        establishmentId: Number(assetForm.establishmentId),
        dependencyId: Number(assetForm.dependencyId),
        assetStateId: Number(assetForm.assetStateId),
        assetTypeId: Number(assetForm.assetTypeId),
        accountingAccount: assetForm.accountingAccount,
        acquisitionDate: assetForm.acquisitionDate,
        depreciationStartDate: assetForm.depreciationStartDate || assetForm.acquisitionDate,
      }
      const applyDepreciationValues = (payload, acquisitionValue) => {
        if (assetForm.depreciationMethod !== 'LINEAL') return payload
        const providedYears = Number(assetForm.usefulLifeYears)
        const withYears =
          Number.isInteger(providedYears) && providedYears > 0
            ? { ...payload, usefulLifeYears: providedYears }
            : payload
        const depreciation = calculateStraightLineDepreciation({
          acquisitionValue,
          usefulLifeYears: assetForm.usefulLifeYears,
          residualValue: assetForm.residualValue,
        })
        if (!depreciation) return withYears
        return {
          ...withYears,
          usefulLifeYears: depreciation.usefulLifeYears,
          depreciationAnnualValue: depreciation.annual,
          depreciationAnnualRate: depreciation.rate,
        }
      }
      if (assetHasResponsible) {
        if (assetForm.responsibleName) basePayload.responsibleName = assetForm.responsibleName
        if (assetForm.responsibleRut) {
          basePayload.responsibleRut = normalizeRutValue(assetForm.responsibleRut)
        }
        if (assetForm.responsibleRole) basePayload.responsibleRole = assetForm.responsibleRole
        if (assetForm.costCenter) {
          basePayload.costCenter = normalizeCostCenterValue(assetForm.costCenter)
        }
      }

      let createdFromSingle = null
      let createdItems = []
      if (useMultiProduct) {
        for (const row of assetMultiProducts) {
          let rowPayload = {
            ...basePayload,
            catalogItemId: Number(row.catalogItemId),
            quantity: Number(row.quantity),
            acquisitionValue: Number(row.acquisitionValue),
          }
          rowPayload = applyDepreciationValues(rowPayload, row.acquisitionValue)
          const created = await api('/assets', { method: 'POST', body: rowPayload })
          const rowItems = Array.isArray(created?.items) ? created.items : created ? [created] : []
          createdItems.push(...rowItems)
        }
      } else {
        let payload = {
          ...basePayload,
          quantity: requestedQuantity,
          acquisitionValue: Number(assetForm.acquisitionValue),
        }
        payload = applyDepreciationValues(payload, assetForm.acquisitionValue)
        if (assetForm.catalogItemId) payload.catalogItemId = Number(assetForm.catalogItemId)
        if (assetForm.name) payload.name = assetForm.name
        if (assetForm.brand) payload.brand = assetForm.brand
        if (assetForm.modelName) payload.modelName = assetForm.modelName
        if (serialValue && requestedQuantity === 1) payload.serialNumber = serialValue
        createdFromSingle = await api('/assets', { method: 'POST', body: payload })
        createdItems = Array.isArray(createdFromSingle?.items)
          ? createdFromSingle.items
          : createdFromSingle
            ? [createdFromSingle]
            : []
      }
      const primaryCreated = createdItems[0] || null
      if (!primaryCreated) {
        setErr('No se recibieron activos creados desde el servidor.')
        return
      }
      let resolved = primaryCreated
      const createdId = toPositiveIntOrNull(primaryCreated?.id)
      if (createdId) {
        try {
          resolved = await api(`/assets/${createdId}`)
        } catch {
          // ignore
        }
      }
      setCreatedAsset(resolved)
      setCreatedAssetBatch(createdItems.length > 1 ? createdItems : [])
      const resolvedId = toPositiveIntOrNull(resolved?.id)
      if (resolvedId) {
        localStorage.setItem('last_asset_id', String(resolvedId))
      }
      const totalCreated = useMultiProduct
        ? createdItems.length
        : Number(createdFromSingle?.createdCount || createdItems.length || 1)
      if (totalCreated > 1) {
        if (!useMultiProduct && serialValue) {
          setOk(`Activos fijos creados: ${totalCreated}. Serie omitida por creacion en lote.`)
        } else {
          setOk(`Activos fijos creados: ${totalCreated}.`)
        }
      } else {
        setOk('Activo fijo creado correctamente.')
      }
      setAssetErrors({})
    } catch (err) {
      const message = getAssetCreateConflictMessage(
        err,
        'No se pudo crear el activo fijo. Verifica los datos e intenta nuevamente.'
      )
      setErr(
        withMappedError(
          err,
          message,
          'No se pudo crear el activo fijo. Verifica los datos e intenta nuevamente.'
        )
      )
    } finally {
      setAssetCreating(false)
    }
  }

  function openCatalogAction(type, assetOverride) {
    const target = assetOverride || createdAsset
    if (!target) {
      setErr('Primero debes crear el activo fijo.')
      return
    }
    if (assetOverride) {
      const overrideId = toPositiveIntOrNull(assetOverride.id)
      setCreatedAsset(assetOverride)
      if (overrideId) localStorage.setItem('last_asset_id', String(overrideId))
    }
    if (type === 'edit') setOk('Accion: editar activo fijo')
    if (type === 'move') setOk('Accion: mover activo fijo')
    if (type === 'transfer') setOk('Accion: transferir activo fijo')
    if (type === 'status') setOk('Accion: dar de baja')
    if (type === 'edit') {
      setEditAssetForm({
        name: target.name || '',
        quantity:
          target.quantity !== undefined && target.quantity !== null
            ? String(target.quantity)
            : '',
        brand: target.brand || '',
        modelName: target.modelName || '',
        serialNumber: target.serialNumber || '',
        accountingAccount: target.accountingAccount || '',
        analyticCode: target.analyticCode || '',
        responsibleName: target.responsibleName || '',
        responsibleRut: target.responsibleRut || '',
        responsibleRole: target.responsibleRole || '',
        costCenter: target.costCenter || '',
        acquisitionValue: target.acquisitionValue || '',
        acquisitionDate: target.acquisitionDate
          ? String(target.acquisitionDate).slice(0, 10)
          : '',
      })
    }
    if (type === 'move') {
      setMoveAssetForm({ toDependencyId: '' })
      const targetEstablishmentId = toPositiveIntOrNull(
        target?.establishmentId || target?.establishment?.id
      )
      if (!targetEstablishmentId) {
        setAssetDependencies([])
        setErr('El activo fijo no tiene establecimiento asociado para mover.')
      } else {
        loadAssetDependencies(targetEstablishmentId).catch((err) => {
          setAssetDependencies([])
          setErr(err)
        })
      }
    }
    if (type === 'transfer') {
      if (!isCentral) {
        setErr('Solo ADMIN_CENTRAL puede transferir activos fijos.')
        setCatalogAction(null)
        return
      }
      if (target.assetState?.name === 'BAJA' || target.isDeleted) {
        setErr('No puedes transferir un activo fijo dado de baja.')
        setCatalogAction(null)
        return
      }
      const transferReasons = movementReasonCodes.transfer || []
      setTransferAssetForm({
        toEstablishmentId: '',
        toDependencyId: '',
        reasonCode: transferReasons[0]?.code || '',
        docType: 'ACTA',
        note: '',
        file: null,
      })
      setTransferDependencies([])
      loadTransferEstablishmentsForAsset(target).catch((err) => setErr(err))
    }
    if (type === 'status') {
      if (target.assetState?.name === 'BAJA' || target.isDeleted) {
        setErr('El activo fijo ya esta dado de baja.')
        setCatalogAction(null)
        return
      }
      if (!assetStates.length) {
        loadAssetStates().catch((err) => setErr(err))
      }
      if (!(movementReasonCodes.statusChange || []).length) {
        loadMovementReasonCodes().catch((err) => setErr(err))
      }
      const baja = assetStates.find((state) => state.name === 'BAJA')
      const statusReasons = movementReasonCodes.statusChange || []
      setStatusAssetForm({
        assetStateId: baja ? String(baja.id) : '',
        reasonCode: statusReasons[0]?.code || '',
        docType: 'ACTA',
        note: '',
        file: null,
      })
      setEditAssetHasResponsible(
        Boolean(
          target.responsibleName ||
            target.responsibleRut ||
            target.responsibleRole ||
            target.costCenter
        )
      )
    }
    setCatalogAction(type)
  }

  function selectAssetForModal(asset, action = null) {
    const assetId = getSafeAssetId(asset)
    if (!assetId) {
      setErr('Activo fijo invalido.')
      return
    }
    setEvidenceForm({ movementId: '', docType: 'ACTA', note: '', file: null })
    setCreatedAsset(asset)
    setCreatedAssetBatch([])
    setSelectedCatalogItem(asset?.catalogItem || null)
    localStorage.setItem('last_asset_id', String(assetId))
    setCatalogModalOpen(true)
    setCatalogAction(null)
    if (action) {
      openCatalogAction(action, asset)
    }
  }

  async function submitEditAsset() {
    const assetId = getSafeAssetId(createdAsset)
    if (!assetId) return
    try {
      const payload = {
        name: editAssetForm.name || undefined,
        quantity:
          editAssetForm.quantity !== '' ? Number(editAssetForm.quantity) : undefined,
        brand: editAssetForm.brand || undefined,
        modelName: editAssetForm.modelName || undefined,
        serialNumber: editAssetForm.serialNumber || undefined,
        accountingAccount: editAssetForm.accountingAccount || undefined,
        analyticCode: editAssetForm.analyticCode || undefined,
        acquisitionValue:
          editAssetForm.acquisitionValue !== ''
            ? Number(editAssetForm.acquisitionValue)
            : undefined,
        acquisitionDate: editAssetForm.acquisitionDate || undefined,
      }
      if (editAssetHasResponsible) {
        payload.responsibleName = editAssetForm.responsibleName || undefined
        if (editAssetForm.responsibleRut) {
          const compact = String(editAssetForm.responsibleRut)
            .trim()
            .replace(/\./g, '')
            .replace(/\s+/g, '')
            .toUpperCase()
          if (!/^\d{7,8}-?[\dK]$/.test(compact)) {
            setErr('RUT responsable invalido. Usa formato 12345678-9')
            return
          }
        }
        payload.responsibleRut = editAssetForm.responsibleRut
          ? normalizeRutValue(editAssetForm.responsibleRut)
          : undefined
        payload.responsibleRole = editAssetForm.responsibleRole || undefined
        payload.costCenter = editAssetForm.costCenter
          ? normalizeCostCenterValue(editAssetForm.costCenter)
          : undefined
      } else {
        payload.responsibleName = ''
        payload.responsibleRut = ''
        payload.responsibleRole = ''
        payload.costCenter = ''
      }
      const updated = await api(`/assets/${assetId}`, {
        method: 'PUT',
        body: payload,
      })
      setCreatedAsset(updated)
      setOk('Activo fijo actualizado.')
      setCatalogAction(null)
    } catch (err) {
      setErr(err)
    }
  }

  async function submitMoveAsset() {
    const assetId = getSafeAssetId(createdAsset)
    if (!assetId) return
    if (!moveAssetForm.toDependencyId) {
      setErr('Selecciona un sector de destino.')
      return
    }
    try {
      const updated = await api(`/assets/${assetId}/relocate`, {
        method: 'PUT',
        body: { toDependencyId: Number(moveAssetForm.toDependencyId) },
      })
      setCreatedAsset(updated)
      await loadAssetsList()
      setOk('Activo fijo movido correctamente.')
      setCatalogAction(null)
    } catch (err) {
      const message = getMoveConflictMessage(err, 'No se pudo mover el activo fijo.')
      setErr(withMappedError(err, message, 'No se pudo mover el activo fijo.'))
    }
  }

  async function submitTransferAsset() {
    const assetId = getSafeAssetId(createdAsset)
    if (!assetId) return
    if (!isCentral) {
      setErr('Solo ADMIN_CENTRAL puede transferir activos fijos.')
      return
    }
    if (!transferAssetForm.toEstablishmentId) {
      setErr('Selecciona establecimiento destino.')
      return
    }
    if (!transferAssetForm.toDependencyId) {
      setErr('Selecciona sector destino.')
      return
    }
    if (!transferAssetForm.reasonCode) {
      setErr('Selecciona motivo de transferencia.')
      return
    }
    if (!transferAssetForm.file) {
      setErr('Adjunta evidencia (PDF/JPG/PNG) para transferir.')
      return
    }
    try {
      const formData = new FormData()
      formData.append('toEstablishmentId', String(Number(transferAssetForm.toEstablishmentId)))
      formData.append('toDependencyId', String(Number(transferAssetForm.toDependencyId)))
      formData.append('reasonCode', transferAssetForm.reasonCode)
      formData.append('docType', transferAssetForm.docType)
      if (transferAssetForm.note) formData.append('note', transferAssetForm.note)
      formData.append('file', transferAssetForm.file)
      const updated = await apiMultipart(`/assets/${assetId}/transfer`, {
        method: 'PUT',
        formData,
      })
      setCreatedAsset(updated)
      setOk('Activo fijo transferido correctamente.')
      setCatalogAction(null)
      await loadAssetsList()
    } catch (err) {
      if (err?.status === 409) {
        try {
          const latest = await api(`/assets/${assetId}`)
          setCreatedAsset(latest)
          await loadAssetsList()
        } catch {
          // ignore secondary refresh error
        }
      }
      setErr(err)
    }
  }

  async function submitStatusAsset() {
    const assetId = getSafeAssetId(createdAsset)
    if (!assetId) return
    if (!statusAssetForm.assetStateId) {
      setErr('Selecciona estado.')
      return
    }
    if (String(createdAsset.assetStateId) === String(statusAssetForm.assetStateId)) {
      setErr('El activo fijo ya tiene ese estado.')
      return
    }
    if (!statusAssetForm.reasonCode) {
      setErr('Selecciona un motivo de baja.')
      return
    }
    if (!statusAssetForm.file) {
      setErr('Adjunta evidencia (PDF/JPG/PNG) para dar de baja.')
      return
    }
    try {
      const formData = new FormData()
      formData.append('assetStateId', String(Number(statusAssetForm.assetStateId)))
      formData.append('reasonCode', statusAssetForm.reasonCode)
      formData.append('docType', statusAssetForm.docType)
      if (statusAssetForm.note) formData.append('note', statusAssetForm.note)
      formData.append('file', statusAssetForm.file)
      const updated = await apiMultipart(`/assets/${assetId}/status`, {
        method: 'PUT',
        formData,
      })
      setCreatedAsset(updated)
      setOk('Estado actualizado.')
      setCatalogAction(null)
      setCatalogModalOpen(false)
    } catch (err) {
      if (err?.status === 409) {
        try {
          const latest = await api(`/assets/${assetId}`)
          setCreatedAsset(latest)
          setStatusAssetForm({
            assetStateId: String(latest?.assetStateId || ''),
            reasonCode: '',
            docType: 'ACTA',
            note: '',
            file: null,
          })
          await loadAssetsList()
        } catch {
          // ignore secondary refresh error
        }
      }
      setErr(err)
    }
  }

  return {
    submitEvidenceUpload,
    prepareEvidenceDocType,
    downloadEvidence,
    getMovementReasonLabel,
    getMovementTitle,
    getMovementActaTitle,
    getMovementRouteLabel,
    isActaEligibleMovement,
    prepareEvidenceForMovement,
    openMovementActa,
    restoreFromTrash,
    confirmRestoreFromTrash,
    handleCreateAsset,
    openCatalogAction,
    selectAssetForModal,
    submitEditAsset,
    submitMoveAsset,
    submitTransferAsset,
    submitStatusAsset,
  }
}

export default useAssetsAdminActions
