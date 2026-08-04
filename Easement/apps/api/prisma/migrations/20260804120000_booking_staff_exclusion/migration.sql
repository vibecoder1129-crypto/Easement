-- Harden concurrent bookings: no overlapping non-cancelled bookings per staff.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "booking_staff_no_overlap";

ALTER TABLE "Booking"
ADD CONSTRAINT "booking_staff_no_overlap"
EXCLUDE USING gist (
  "staffId" WITH =,
  tstzrange("startDatetime", "endDatetime", '[)') WITH &&
)
WHERE ("status" <> 'cancelled');
