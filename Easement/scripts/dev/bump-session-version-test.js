const { PrismaClient } = require('@prisma/client');

async function main() {
  const p = new PrismaClient();
  const email = process.argv[2] || 'sofia.client@easement.local';
  const before = await p.$queryRaw`
    SELECT email, "sessionVersion" FROM "User" WHERE email = ${email}
  `;
  await p.$executeRaw`
    UPDATE "User" SET "sessionVersion" = "sessionVersion" + 1 WHERE email = ${email}
  `;
  const after = await p.$queryRaw`
    SELECT email, "sessionVersion" FROM "User" WHERE email = ${email}
  `;
  console.log(JSON.stringify({ before, after }, null, 2));
  // revert so we don't strand real sessions unexpectedly in local demo
  await p.$executeRaw`
    UPDATE "User" SET "sessionVersion" = "sessionVersion" - 1 WHERE email = ${email}
  `;
  console.log('reverted bump for demo account');
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
