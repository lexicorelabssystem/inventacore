import { UI_TEXT } from '../constants/uiText'

function ImportsSection(props) {
  const { children, importsView, setImportsView } = props

  return (
    <>
      <div className="section">
        <div className="section-head">
          <h3>Importaciones</h3>
          <div className="actions">
            <button
              className={importsView === 'assets' ? 'primary' : 'ghost'}
              onClick={() => setImportsView('assets')}
            >
              {UI_TEXT.assetPlural}
            </button>
            <button
              className={importsView === 'catalog' ? 'primary' : 'ghost'}
              onClick={() => setImportsView('catalog')}
            >
              {UI_TEXT.catalogStandard}
            </button>
            <button
              className={importsView === 'sn' ? 'primary' : 'ghost'}
              onClick={() => setImportsView('sn')}
            >
              {UI_TEXT.catalogBaseSn}
            </button>
          </div>
        </div>
      </div>
      {children}
    </>
  )
}

export default ImportsSection

