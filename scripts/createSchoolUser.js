// scripts/createSchoolUser.js
require("dotenv").config();
const { prisma } = require("../src/prisma");
const { hashPassword } = require("../src/utils/password");

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Falta ${name}. Define el dato de forma segura en el entorno.`);
  }
  return value;
}

async function main() {
  const name = requireEnv("CREATE_SCHOOL_USER_NAME");
  const email = requireEnv("CREATE_SCHOOL_USER_EMAIL").toLowerCase();
  const password = requireEnv("CREATE_SCHOOL_USER_PASSWORD");
  const institutionId = Number(requireEnv("CREATE_SCHOOL_USER_INSTITUTION_ID"));
  const establishmentId = Number(requireEnv("CREATE_SCHOOL_USER_ESTABLISHMENT_ID"));

  if (!Number.isInteger(institutionId) || !Number.isInteger(establishmentId)) {
    throw new Error("Los identificadores de institucion y establecimiento deben ser enteros.");
  }
  if (password.length < 12) {
    throw new Error("CREATE_SCHOOL_USER_PASSWORD debe tener al menos 12 caracteres.");
  }

  // Obtener rol ADMIN_ESTABLISHMENT
  const role = await prisma.role.upsert({
    where: { type: "ADMIN_ESTABLISHMENT" },
    update: {},
    create: { type: "ADMIN_ESTABLISHMENT" },
  });

  // Crear usuario de establecimiento
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: await hashPassword(password),
      roleId: role.id,
      institutionId,
      establishmentId,
    },
    include: {
      role: true,
    },
  });

  console.log("Usuario escuela creado:");
  console.log({
    id: user.id,
    email: user.email,
    role: user.role.type,
    establishmentId: user.establishmentId,
  });

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Error creando usuario escuela:", e);
  await prisma.$disconnect();
  process.exit(1);
});
