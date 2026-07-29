require("dotenv").config();
const { prisma } = require("../src/prisma");

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function isPlaceholderUser(user) {
  const name = String(user?.name || "");
  return /(\bqa\b|\btest\b)/i.test(name);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true },
    orderBy: { id: "asc" },
  });

  const takenEmails = new Set(
    users.map((user) => String(user.email || "").trim().toLowerCase()).filter(Boolean)
  );
  const planned = [];
  let placeholderCounter = 0;

  for (const user of users) {
    const originalName = String(user.name || "").trim();
    const placeholder = isPlaceholderUser(user);

    const nextName = placeholder
      ? `Usuario Demo ${String(++placeholderCounter).padStart(2, "0")}`
      : originalName;

    let localPart = placeholder ? `usuario-demo-${String(placeholderCounter).padStart(2, "0")}` : slugify(nextName);
    if (!localPart) {
      localPart = `usuario-${user.id}`;
    }

    let nextEmail = `${localPart}@inventacore.cl`;
    let suffix = 2;
    while (takenEmails.has(nextEmail.toLowerCase()) && nextEmail.toLowerCase() !== String(user.email || "").toLowerCase()) {
      nextEmail = `${localPart}-${suffix++}@inventacore.cl`;
    }
    takenEmails.add(nextEmail.toLowerCase());

    planned.push({
      id: user.id,
      fromName: originalName,
      toName: nextName,
      fromEmail: user.email,
      toEmail: nextEmail,
    });
  }

  if (dryRun) {
    console.log(JSON.stringify({ ok: true, dryRun: true, planned }, null, 2));
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    for (const item of planned) {
      await tx.user.update({
        where: { id: item.id },
        data: { name: item.toName, email: item.toEmail },
      });
    }
    return { updatedCount: planned.length };
  });

  console.log(JSON.stringify({ ok: true, dryRun: false, ...result, planned }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
