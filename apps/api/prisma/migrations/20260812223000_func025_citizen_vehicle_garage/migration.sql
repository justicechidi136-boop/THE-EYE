CREATE TABLE IF NOT EXISTS citizen_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  make text NOT NULL,
  model text NOT NULL,
  year integer,
  color text,
  plate_number text NOT NULL,
  vin text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, plate_number)
);

CREATE INDEX IF NOT EXISTS idx_citizen_vehicles_user_id_is_primary
  ON citizen_vehicles(user_id, is_primary);

CREATE INDEX IF NOT EXISTS idx_citizen_vehicles_user_id_updated_at
  ON citizen_vehicles(user_id, updated_at DESC);
