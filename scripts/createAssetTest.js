// scripts/createAssetTest.js
const { prisma } = require("../src/prisma");

async function main() {
  const institution = await prisma.institution.findFirst({
    include: { assetSequence: true },
  });

  if (!institution || !institution.assetSequence) {
    throw new Error("No existe Institution o AssetSequence");
  }

  const nextCode = institution.assetSequence.lastNumber + 1;

  const assetType = await prisma.assetType.findUnique({
    where: { name: "FIXED" },
  });

  const assetState = await prisma.assetState.findUnique({
    where: { name: "BUENO" },
  });

  const establishment = await prisma.establishment.findFirst();
  const dependency = await prisma.dependency.findFirst();
  const user = await prisma.user.findFirst();

  if (!assetType || !assetState || !establishment || !dependency || !user) {
    throw new Error("Faltan datos base");
  }

  const asset = await prisma.$transaction(async (tx) => {
    const created = await tx.asset.create({
      data: {
        internalCode: nextCode,
        name: "Notebook Lenovo Test",
        brand: "Lenovo",
        modelName: "ThinkPad X1",
        serialNumber: "SN-TEST-001",
        acquisitionValue: 1200000,
        acquisitionDate: new Date(),
        assetTypeId: assetType.id,
        assetStateId: assetState.id,
        establishmentId: establishment.id,
        dependencyId: dependency.id,
      },
    });

    await tx.movement.create({
      data: {
        type: "INVENTORY_CHECK",
        assetId: created.id,
        userId: user.id,
      },
    });

    await tx.assetSequence.update({
      where: { institutionId: institution.id },
      data: { lastNumber: nextCode },
    });

    return created;
  });

  console.log("Asset creado correctamente:");
  console.log(asset);
}

main()
  .catch((e) => console.error("Error:", e))
  .finally(async () => {
    await prisma.$disconnect();
  });

