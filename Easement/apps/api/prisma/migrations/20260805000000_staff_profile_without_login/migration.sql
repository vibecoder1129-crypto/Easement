-- Staff can exist without a linked User login; profile fields live on Staff.
ALTER TABLE "Staff" ADD COLUMN "name" TEXT;
ALTER TABLE "Staff" ADD COLUMN "email" TEXT;
ALTER TABLE "Staff" ADD COLUMN "phone" TEXT;

UPDATE "Staff" AS s
SET
  "name" = u."name",
  "email" = u."email",
  "phone" = u."phone"
FROM "User" AS u
WHERE s."userId" = u."id";

ALTER TABLE "Staff" ALTER COLUMN "name" SET NOT NULL;

ALTER TABLE "Staff" DROP CONSTRAINT "Staff_userId_fkey";
ALTER TABLE "Staff" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
