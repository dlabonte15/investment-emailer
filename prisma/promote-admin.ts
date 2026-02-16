import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  if (users.length === 0) {
    console.log("No users found in database. Log in to the app first.");
    return;
  }

  console.log("Current users:");
  for (const u of users) {
    console.log(`  ${u.id}: ${u.email} (${u.name}) — role: ${u.role}`);
  }

  // Promote the first user
  const target = users[0];
  if (target.role === "admin") {
    console.log(`\n${target.email} is already an admin.`);
    return;
  }

  await prisma.user.update({
    where: { id: target.id },
    data: { role: "admin" },
  });

  console.log(`\nPromoted ${target.email} to admin.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
