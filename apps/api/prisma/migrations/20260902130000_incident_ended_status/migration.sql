ALTER TYPE "IncidentStatus" ADD VALUE IF NOT EXISTS 'Ended';

ALTER TABLE "incidents"
ADD COLUMN "ended_at" TIMESTAMPTZ(6);
