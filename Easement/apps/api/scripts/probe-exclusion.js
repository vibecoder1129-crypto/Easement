const { PrismaClient } = require('@prisma/client');

async function main() {
  const p = new PrismaClient();
  const ver = await p.$queryRawUnsafe('SHOW server_version');
  const ext = await p.$queryRawUnsafe(
    "SELECT extname, extversion FROM pg_extension WHERE extname = 'btree_gist'",
  );
  const cons = await p.$queryRawUnsafe(`
    SELECT conname FROM pg_constraint WHERE conname = 'booking_staff_no_overlap'
  `);
  console.log(JSON.stringify({ ver, ext, cons }, null, 2));

  // Try without WHERE clause
  try {
    await p.$executeRawUnsafe(`
      ALTER TABLE "Booking"
      ADD CONSTRAINT "booking_staff_no_overlap"
      EXCLUDE USING gist (
        "staffId" WITH =,
        tstzrange("startDatetime", "endDatetime", '[)') WITH &&
      )
    `);
    console.log('added without WHERE');
  } catch (e) {
    console.error('no-where failed:', e.meta?.message || e.message);
  }

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
