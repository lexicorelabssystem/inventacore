// scripts/testInstitutionIdGuard.js
const { createAssetBody } = require("../src/validators/assetSchemas");

function runCase(name, payload) {
  const result = createAssetBody.safeParse(payload);
  if (result.success) {
    console.log(`${name}: esperado error, pero paso`);
    process.exitCode = 1;
    return;
  }
  const messages = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  console.log(`${name}: rechazado -> ${messages.join(" | ")}`);
}

const basePayload = {
  establishmentId: 3,
  dependencyId: 3,
  assetStateId: 1,
  name: "Notebook",
  accountingAccount: "123-ABC",
  analyticCode: "AN-001",
  acquisitionValue: 1000,
  acquisitionDate: new Date(),
};

runCase("Con institutionId", { ...basePayload, institutionId: 99 });
