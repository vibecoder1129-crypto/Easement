const { PrismaClient } = require('@prisma/client');

async function main() {
  const p = new PrismaClient();
  const users = await p.user.findMany({
    select: { email: true, sessionVersion: true },
    take: 10,
    orderBy: { sessionVersion: 'desc' },
  });
  console.log(JSON.stringify(users, null, 2));
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
