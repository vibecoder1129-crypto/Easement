const { PrismaClient } = require('@prisma/client');

async function main() {
  const p = new PrismaClient();
  const procs = await p.$queryRawUnsafe(`
    SELECT proname, provolatile, oidvectortypes(proargtypes) AS args
    FROM pg_proc
    WHERE proname IN ('tstzrange', 'booking_time_range')
    ORDER BY proname
  `);
  console.log(JSON.stringify(procs, null, 2));

  // Stored generated-like approach: plain range column maintained by trigger
  await p.$executeRawUnsafe(`
    ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "slotRange" tstzrange
  `);
  await p.$executeRawUnsafe(`
    UPDATE "Booking"
    SET "slotRange" = tstzrange("startDatetime", "endDatetime", '[)')
    WHERE "slotRange" IS NULL
  `);
  await p.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION booking_set_slot_range()
    RETURNS trigger AS $$
    BEGIN
      NEW."slotRange" := tstzrange(NEW."startDatetime", NEW."endDatetime", '[)');
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `);
  await p.$executeRawUnsafe(`
    DROP TRIGGER IF EXISTS booking_slot_range_trg ON "Booking"
  `);
  await p.$executeRawUnsafe(`
    CREATE TRIGGER booking_slot_range_trg
    BEFORE INSERT OR UPDATE OF "startDatetime", "endDatetime"
    ON "Booking"
    FOR EACH ROW EXECUTE FUNCTION booking_set_slot_range()
  `);
  await p.$executeRawUnsafe(
    'ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "booking_staff_no_overlap"',
  );
  await p.$executeRawUnsafe(`
    ALTER TABLE "Booking"
    ADD CONSTRAINT "booking_staff_no_overlap"
    EXCLUDE USING gist (
      "staffId" WITH =,
      "slotRange" WITH &&
    )
    WHERE ("status" IN ('confirmed', 'pending'))
  `);
  const cons = await p.$queryRawUnsafe(`
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint WHERE conname = 'booking_staff_no_overlap'
  `);
  console.log(JSON.stringify(cons, null, 2));
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
