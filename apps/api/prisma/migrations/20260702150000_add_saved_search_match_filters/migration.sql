ALTER TABLE "saved_searches"
ADD COLUMN "excludeSeniorRoles" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "preferJuniorRoles" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "excludeContract" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "excludeStaffingAgencies" BOOLEAN NOT NULL DEFAULT false;
