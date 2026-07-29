function TabPanel({ children, className = '' }) {
  return <div className={className}>{children}</div>
}

function InstitutionsTabPanel({ children }) {
  return <TabPanel>{children}</TabPanel>
}

function EstablishmentsTabPanel({ children }) {
  return <TabPanel>{children}</TabPanel>
}

function DependenciesTabPanel({ children }) {
  return <TabPanel>{children}</TabPanel>
}

function UsersTabPanel({ children }) {
  return <TabPanel>{children}</TabPanel>
}

function AssistantTabPanel({ children }) {
  return <TabPanel className="module-shell module-shell-assistant">{children}</TabPanel>
}

function AssetsTabPanel({ children }) {
  return <TabPanel className="module-shell module-shell-assets">{children}</TabPanel>
}

function TrashTabPanel({ children }) {
  return <TabPanel className="module-shell module-shell-trash">{children}</TabPanel>
}

function ImportsTabPanel({ children }) {
  return <TabPanel>{children}</TabPanel>
}

function PlanchetasTabPanel({ children }) {
  return <TabPanel className="module-shell module-shell-planchetas">{children}</TabPanel>
}

function AuditTabPanel({ children }) {
  return <TabPanel>{children}</TabPanel>
}

export {
  InstitutionsTabPanel,
  EstablishmentsTabPanel,
  DependenciesTabPanel,
  UsersTabPanel,
  AssistantTabPanel,
  AssetsTabPanel,
  TrashTabPanel,
  ImportsTabPanel,
  PlanchetasTabPanel,
  AuditTabPanel,
}
