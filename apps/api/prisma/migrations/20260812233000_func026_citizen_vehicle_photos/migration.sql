CREATE TABLE IF NOT EXISTS citizen_vehicle_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES citizen_vehicles(id) ON DELETE CASCADE,
  object_key text NOT NULL,
  content_type text NOT NULL,
  size_bytes integer,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_citizen_vehicle_photos_vehicle_id_sort_order
  ON citizen_vehicle_photos(vehicle_id, sort_order);
