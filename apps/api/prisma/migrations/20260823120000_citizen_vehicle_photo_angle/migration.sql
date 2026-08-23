ALTER TABLE "citizen_vehicle_photos"
ADD COLUMN "angle" TEXT NOT NULL DEFAULT 'OTHER';

ALTER TABLE "citizen_vehicle_photos"
ADD CONSTRAINT "citizen_vehicle_photos_angle_check"
CHECK ("angle" IN ('FRONT', 'REAR', 'SIDE', 'OTHER'));
