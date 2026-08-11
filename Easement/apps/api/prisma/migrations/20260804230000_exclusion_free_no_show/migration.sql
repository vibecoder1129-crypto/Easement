-- Free no_show (and completed) chairs for concurrent booking safety.
-- PG rejects expression indexes on tstzrange(...) in some setups, so store the range.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "slotRange" tstzrange;

UPDATE "Booking"
SET "slotRange" = tstzrange("startDatetime", "endDatetime", '[)')
WHERE "slotRange" IS NULL;

CREATE OR REPLACE FUNCTION booking_set_slot_range()
RETURNS trigger AS $$
BEGIN
  NEW."slotRange" := tstzrange(NEW."startDatetime", NEW."endDatetime", '[)');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS booking_slot_range_trg ON "Booking";

CREATE TRIGGER booking_slot_range_trg
BEFORE INSERT OR UPDATE OF "startDatetime", "endDatetime"
ON "Booking"
FOR EACH ROW EXECUTE FUNCTION booking_set_slot_range();

ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "booking_staff_no_overlap";

ALTER TABLE "Booking"
ADD CONSTRAINT "booking_staff_no_overlap"
EXCLUDE USING gist (
  "staffId" WITH =,
  "slotRange" WITH &&
)
WHERE ("status" IN ('confirmed', 'pending'));
