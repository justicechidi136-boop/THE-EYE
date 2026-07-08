CREATE TYPE "BroadcastType" AS ENUM (
  'Emergency',
  'Crime',
  'Accident',
  'MissingPerson',
  'StolenVehicle',
  'GovernmentAlert',
  'CommunityWarning'
);

CREATE TYPE "BroadcastDeliveryStatus" AS ENUM (
  'Queued',
  'Sent',
  'Delivered',
  'Failed',
  'Read'
);

ALTER TYPE "BroadcastStatus" ADD VALUE IF NOT EXISTS 'Rejected';

ALTER TABLE broadcasts
  ADD COLUMN incident_id uuid REFERENCES incidents(id),
  ADD COLUMN type "BroadcastType" NOT NULL DEFAULT 'CommunityWarning',
  ADD COLUMN requires_approval boolean NOT NULL DEFAULT true,
  ADD COLUMN auto_published boolean NOT NULL DEFAULT false,
  ADD COLUMN target_radius_meters integer,
  ADD COLUMN target_center geography(Point,4326),
  ADD COLUMN rejected_reason text;

CREATE INDEX idx_broadcasts_type_status ON broadcasts(type, status);
CREATE INDEX idx_broadcasts_incident_id ON broadcasts(incident_id);
CREATE INDEX idx_broadcasts_target_center ON broadcasts USING gist(target_center);

CREATE TABLE broadcast_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_id uuid REFERENCES notifications(id),
  distance_meters numeric(10,2),
  status "BroadcastDeliveryStatus" NOT NULL DEFAULT 'Queued',
  channel text NOT NULL DEFAULT 'push',
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  read_at timestamptz,
  UNIQUE (broadcast_id, user_id)
);

CREATE INDEX idx_broadcast_deliveries_user_status_created_at ON broadcast_deliveries(user_id, status, created_at DESC);
CREATE INDEX idx_broadcast_deliveries_broadcast_status ON broadcast_deliveries(broadcast_id, status);

UPDATE admin_roles
   SET permissions = array_append(permissions, 'broadcast:publish')
 WHERE name IN ('Super Admin', 'Country Admin', 'State Admin')
   AND NOT ('broadcast:publish' = ANY(permissions));
