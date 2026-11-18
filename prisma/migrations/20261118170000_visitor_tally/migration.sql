-- Visits counted for the live map on the landing page: per UTC day and IANA time zone, the number
-- of different browsers that came. No IP address, account or browser id is stored.
CREATE TABLE "VisitorTally" (
    "day" TEXT NOT NULL,
    "tz" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VisitorTally_pkey" PRIMARY KEY ("day","tz")
);
