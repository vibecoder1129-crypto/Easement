-- Harden concurrent bookings: btree_gist for staff overlap (see 20260804230000_exclusion_free_no_show).
-- PG rejects tstzrange(...) in EXCLUDE index expressions (not IMMUTABLE); overlap uses stored slotRange later.
CREATE EXTENSION IF NOT EXISTS btree_gist;