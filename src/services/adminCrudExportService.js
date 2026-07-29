const ExcelJS = require("exceljs");
const { prisma } = require("../prisma");
const { forbidden } = require("../utils/httpError");

function requireCentral(user) {
  if (user.role.type !== "ADMIN_CENTRAL") {
    throw forbidden("Solo ADMIN_CENTRAL puede exportar admin");
  }
}

async function exportInstitutions(user) {
  requireCentral(user);
  const items = await prisma.institution.findMany({ orderBy: { name: "asc" } });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Institutions");
  sheet.columns = [
    { header: "ID", key: "id", width: 10 },
    { header: "Nombre", key: "name", width: 30 },
    { header: "Creado", key: "createdAt", width: 20 },
  ];

  items.forEach((i) => {
    sheet.addRow({
      id: i.id,
      name: i.name,
      createdAt: i.createdAt.toISOString(),
    });
  });

  sheet.getRow(1).font = { bold: true };
  return workbook;
}

async function exportEstablishments(user) {
  requireCentral(user);
  const items = await prisma.establishment.findMany({
    orderBy: { name: "asc" },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Establishments");
  sheet.columns = [
    { header: "ID", key: "id", width: 10 },
    { header: "Nombre", key: "name", width: 30 },
    { header: "Tipo", key: "type", width: 15 },
    { header: "RBD", key: "rbd", width: 14 },
    { header: "Comuna", key: "commune", width: 18 },
    { header: "Institution ID", key: "institutionId", width: 15 },
    { header: "Creado", key: "createdAt", width: 20 },
  ];

  items.forEach((e) => {
    sheet.addRow({
      id: e.id,
      name: e.name,
      type: e.type,
      rbd: e.rbd || "",
      commune: e.commune || "",
      institutionId: e.institutionId,
      createdAt: e.createdAt.toISOString(),
    });
  });

  sheet.getRow(1).font = { bold: true };
  return workbook;
}

async function exportDependencies(user) {
  requireCentral(user);
  const items = await prisma.dependency.findMany({
    orderBy: { name: "asc" },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Dependencies");
  sheet.columns = [
    { header: "ID", key: "id", width: 10 },
    { header: "Nombre", key: "name", width: 30 },
    { header: "Establishment ID", key: "establishmentId", width: 18 },
    { header: "Creado", key: "createdAt", width: 20 },
  ];

  items.forEach((d) => {
    sheet.addRow({
      id: d.id,
      name: d.name,
      establishmentId: d.establishmentId,
      createdAt: d.createdAt.toISOString(),
    });
  });

  sheet.getRow(1).font = { bold: true };
  return workbook;
}

module.exports = {
  exportInstitutions,
  exportEstablishments,
  exportDependencies,
};

