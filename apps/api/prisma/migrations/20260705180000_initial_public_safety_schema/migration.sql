CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE "UserStatus" AS ENUM ('Active', 'Suspended', 'Deactivated');
CREATE TYPE "KycStatus" AS ENUM ('Pending', 'Verified', 'Rejected', 'Expired');
CREATE TYPE "IncidentStatus" AS ENUM ('Submitted', 'Received', 'Verifying', 'Verified', 'Assigned', 'Responding', 'Resolved', 'Closed', 'FalseReport');
CREATE TYPE "IncidentPriority" AS ENUM ('P1LifeThreatening', 'P2ActiveCrimeAccident', 'P3SuspiciousActivity', 'P4GeneralSafety');
CREATE TYPE "IncidentType" AS ENUM ('Emergency', 'Crime', 'Accident', 'Fire', 'Medical', 'CommunitySafety', 'Kidnapping', 'Abuse', 'SuspiciousActivity', 'MissingPerson', 'StolenVehicle', 'SOS');
CREATE TYPE "MediaType" AS ENUM ('Image', 'Video', 'Audio', 'Document', 'LiveVideoRecording');
CREATE TYPE "BroadcastStatus" AS ENUM ('Draft', 'PendingApproval', 'Published', 'Expired', 'Cancelled');
CREATE TYPE "NotificationStatus" AS ENUM ('Pending', 'Sent', 'Delivered', 'Failed', 'Read');
CREATE TYPE "ReportStatus" AS ENUM ('Draft', 'Generated', 'Reviewed', 'Published', 'Archived');
CREATE TYPE "EscalationStatus" AS ENUM ('Pending', 'Notified', 'Acknowledged', 'Resolved', 'Cancelled');

CREATE TABLE jurisdictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country text NOT NULL,
  state text NOT NULL,
  lga text NOT NULL,
  name text NOT NULL,
  boundary geography(MultiPolygon,4326),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT jurisdictions_country_state_lga_key UNIQUE (country, state, lga)
);
CREATE INDEX idx_jurisdictions_country_state_lga ON jurisdictions(country, state, lga);
CREATE INDEX idx_jurisdictions_boundary ON jurisdictions USING gist(boundary);

CREATE TABLE admin_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  permissions text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  phone text UNIQUE,
  password_hash text,
  status "UserStatus" NOT NULL DEFAULT 'Active',
  is_trusted_reporter boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth date,
  gender text,
  address text,
  country text NOT NULL,
  state text NOT NULL,
  lga text NOT NULL,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_country_state_lga ON profiles(country, state, lga);

CREATE TABLE kyc_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  document_number text,
  document_hash text NOT NULL,
  status "KycStatus" NOT NULL DEFAULT 'Pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_kyc_records_user_status ON kyc_records(user_id, status);

CREATE TABLE emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  relationship text NOT NULL,
  priority integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_emergency_contacts_user_id ON emergency_contacts(user_id);

CREATE TABLE agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id uuid NOT NULL REFERENCES jurisdictions(id),
  name text NOT NULL,
  type text NOT NULL,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_agencies_jurisdiction_type ON agencies(jurisdiction_id, type);

CREATE TABLE admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES admin_roles(id),
  agency_id uuid REFERENCES agencies(id),
  jurisdiction_id uuid NOT NULL REFERENCES jurisdictions(id),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  country text NOT NULL,
  state text NOT NULL,
  lga text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_admin_users_country_state_lga ON admin_users(country, state, lga);
CREATE INDEX idx_admin_users_jurisdiction_id ON admin_users(jurisdiction_id);

CREATE TABLE incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES users(id),
  jurisdiction_id uuid NOT NULL REFERENCES jurisdictions(id),
  assigned_agency_id uuid REFERENCES agencies(id),
  assigned_admin_id uuid REFERENCES admin_users(id),
  type "IncidentType" NOT NULL,
  status "IncidentStatus" NOT NULL DEFAULT 'Submitted',
  priority "IncidentPriority" NOT NULL DEFAULT 'P4GeneralSafety',
  title text NOT NULL,
  description text,
  address text,
  country text NOT NULL,
  state text NOT NULL,
  lga text NOT NULL,
  latitude numeric(9,6) NOT NULL,
  longitude numeric(9,6) NOT NULL,
  gps_location geography(Point,4326) NOT NULL,
  manual_latitude numeric(9,6),
  manual_longitude numeric(9,6),
  manual_gps_location geography(Point,4326),
  manual_address text,
  manual_location_adjusted boolean NOT NULL DEFAULT false,
  is_anonymous boolean NOT NULL DEFAULT false,
  notify_emergency_contacts boolean NOT NULL DEFAULT false,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  closed_at timestamptz,
  CONSTRAINT incidents_latitude_check CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT incidents_longitude_check CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT incidents_scope_matches_jurisdiction FOREIGN KEY (country, state, lga) REFERENCES jurisdictions(country, state, lga)
);
CREATE INDEX idx_incidents_gps_location ON incidents USING gist(gps_location);
CREATE INDEX idx_incidents_manual_gps_location ON incidents USING gist(manual_gps_location);
CREATE INDEX idx_incidents_type_created_at ON incidents(type, created_at DESC);
CREATE INDEX idx_incidents_country_state_lga ON incidents(country, state, lga);
CREATE INDEX idx_incidents_status_priority_created_at ON incidents(status, priority, created_at DESC);
CREATE INDEX idx_incidents_jurisdiction_status ON incidents(jurisdiction_id, status);

CREATE TABLE incident_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL REFERENCES users(id),
  media_type "MediaType" NOT NULL,
  bucket text NOT NULL,
  object_key text NOT NULL,
  content_type text NOT NULL,
  size_bytes bigint,
  file_hash text NOT NULL UNIQUE,
  captured_at timestamptz NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  latitude numeric(9,6) NOT NULL,
  longitude numeric(9,6) NOT NULL,
  gps_location geography(Point,4326) NOT NULL,

  metadata jsonb NOT NULL DEFAULT '{}',
  CONSTRAINT incident_media_latitude_check CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT incident_media_longitude_check CHECK (longitude BETWEEN -180 AND 180)
);
CREATE INDEX idx_incident_media_incident_id ON incident_media(incident_id);
CREATE INDEX idx_incident_media_uploader_id ON incident_media(uploader_id);
CREATE INDEX idx_incident_media_gps_location ON incident_media USING gist(gps_location);

CREATE TABLE incident_media_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id uuid NOT NULL REFERENCES incident_media(id) ON DELETE CASCADE,
  accessor_id uuid REFERENCES users(id),
  admin_user_id uuid REFERENCES admin_users(id),
  action text NOT NULL,
  reason text,
  ip_address inet,
  user_agent text,
  accessed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT incident_media_access_actor_check CHECK (accessor_id IS NOT NULL OR admin_user_id IS NOT NULL)
);
CREATE INDEX idx_media_access_logs_media_accessed_at ON incident_media_access_logs(media_id, accessed_at DESC);
CREATE INDEX idx_media_access_logs_accessor_id ON incident_media_access_logs(accessor_id);
CREATE INDEX idx_media_access_logs_admin_user_id ON incident_media_access_logs(admin_user_id);

CREATE TABLE incident_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  verifier_id uuid REFERENCES users(id),
  method text NOT NULL,
  result text NOT NULL,
  confidence numeric(5,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_incident_verifications_incident_result ON incident_verifications(incident_id, result);

CREATE TABLE incident_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES users(id),
  actor_type text NOT NULL,
  event_type text NOT NULL,
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_incident_timeline_incident_created_at ON incident_timeline(incident_id, created_at DESC);

CREATE TABLE incident_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  from_status "IncidentStatus",
  to_status "IncidentStatus" NOT NULL,
  changed_by_id uuid REFERENCES users(id),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_status_history_incident_created_at ON incident_status_history(incident_id, created_at DESC);

CREATE TABLE broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id uuid REFERENCES jurisdictions(id),
  creator_admin_id uuid NOT NULL REFERENCES admin_users(id),
  approver_admin_id uuid REFERENCES admin_users(id),
  title text NOT NULL,
  body text NOT NULL,
  status "BroadcastStatus" NOT NULL DEFAULT 'Draft',
  priority "IncidentPriority" NOT NULL DEFAULT 'P4GeneralSafety',
  target_area geography(MultiPolygon,4326),
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_broadcasts_status_published_at ON broadcasts(status, published_at DESC);
CREATE INDEX idx_broadcasts_jurisdiction_id ON broadcasts(jurisdiction_id);
CREATE INDEX idx_broadcasts_target_area ON broadcasts USING gist(target_area);

CREATE TABLE vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES users(id),
  plate_number text NOT NULL UNIQUE,
  vin text UNIQUE,
  make text NOT NULL,
  model text NOT NULL,
  color text,
  year integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vehicles_owner_id ON vehicles(owner_id);

CREATE TABLE stolen_vehicle_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  reporter_id uuid REFERENCES users(id),
  incident_id uuid REFERENCES incidents(id),
  status text NOT NULL DEFAULT 'Open',
  last_seen_at timestamptz,
  last_seen_area text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  gps_location geography(Point,4326),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stolen_vehicle_latitude_check CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CONSTRAINT stolen_vehicle_longitude_check CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);
CREATE INDEX idx_stolen_vehicle_reports_status_created_at ON stolen_vehicle_reports(status, created_at DESC);
CREATE INDEX idx_stolen_vehicle_reports_gps_location ON stolen_vehicle_reports USING gist(gps_location);

CREATE TABLE missing_person_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES users(id),
  incident_id uuid REFERENCES incidents(id),
  full_name text NOT NULL,
  age integer,
  gender text,
  description text NOT NULL,
  last_seen_at timestamptz,
  last_seen_address text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  gps_location geography(Point,4326),
  status text NOT NULL DEFAULT 'Open',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT missing_person_latitude_check CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CONSTRAINT missing_person_longitude_check CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);
CREATE INDEX idx_missing_person_reports_status_created_at ON missing_person_reports(status, created_at DESC);
CREATE INDEX idx_missing_person_reports_gps_location ON missing_person_reports USING gist(gps_location);

CREATE TABLE police_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES agencies(id),
  jurisdiction_id uuid NOT NULL REFERENCES jurisdictions(id),
  name text NOT NULL,
  phone text,
  address text NOT NULL,
  latitude numeric(9,6) NOT NULL,
  longitude numeric(9,6) NOT NULL,
  gps_location geography(Point,4326) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT police_stations_latitude_check CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT police_stations_longitude_check CHECK (longitude BETWEEN -180 AND 180)
);
CREATE INDEX idx_police_stations_jurisdiction_id ON police_stations(jurisdiction_id);
CREATE INDEX idx_police_stations_gps_location ON police_stations USING gist(gps_location);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  incident_id uuid REFERENCES incidents(id),
  broadcast_id uuid REFERENCES broadcasts(id),
  channel text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  status "NotificationStatus" NOT NULL DEFAULT 'Pending',
  provider text,
  provider_message_id text,
  error text,
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_status_created_at ON notifications(user_id, status, created_at DESC);
CREATE INDEX idx_notifications_incident_id ON notifications(incident_id);

CREATE TABLE neighborhood_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id uuid NOT NULL REFERENCES jurisdictions(id),
  name text NOT NULL,
  description text,
  created_by_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_neighborhood_groups_jurisdiction_id ON neighborhood_groups(jurisdiction_id);

CREATE TABLE group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES neighborhood_groups(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_group_messages_group_created_at ON group_messages(group_id, created_at DESC);

CREATE TABLE live_video_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  room_name text NOT NULL UNIQUE,
  livekit_room_id text,
  started_at timestamptz,
  ended_at timestamptz,
  recording_media_id uuid REFERENCES incident_media(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_live_video_sessions_incident_id ON live_video_sessions(incident_id);

CREATE TABLE smartwatch_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id text NOT NULL UNIQUE,
  provider text NOT NULL,
  last_seen_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_smartwatch_devices_user_id ON smartwatch_devices(user_id);

CREATE TABLE sos_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  device_id uuid REFERENCES smartwatch_devices(id),
  incident_id uuid REFERENCES incidents(id),
  latitude numeric(9,6) NOT NULL,
  longitude numeric(9,6) NOT NULL,
  gps_location geography(Point,4326) NOT NULL,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT sos_events_latitude_check CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT sos_events_longitude_check CHECK (longitude BETWEEN -180 AND 180)
);
CREATE INDEX idx_sos_events_user_triggered_at ON sos_events(user_id, triggered_at DESC);
CREATE INDEX idx_sos_events_gps_location ON sos_events USING gist(gps_location);

CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid REFERENCES incidents(id),
  generated_by_id uuid NOT NULL REFERENCES admin_users(id),
  title text NOT NULL,
  report_type text NOT NULL,
  status "ReportStatus" NOT NULL DEFAULT 'Draft',
  storage_bucket text,
  storage_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_reports_type_status ON reports(report_type, status);

CREATE TABLE trusted_reporters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  trust_score numeric(5,2) NOT NULL DEFAULT 80.00,
  verification_level text NOT NULL DEFAULT 'Community',
  reports_submitted integer NOT NULL DEFAULT 0,
  reports_verified integer NOT NULL DEFAULT 0,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_trusted_reporters_trust_score ON trusted_reporters(trust_score DESC);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id),
  actor_admin_id uuid REFERENCES admin_users(id),
  actor_type text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  ip_address inet,
  user_agent text,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_actor_check CHECK (actor_user_id IS NOT NULL OR actor_admin_id IS NOT NULL OR actor_type = 'system')
);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_logs_actor_user ON audit_logs(actor_user_id, created_at DESC);
CREATE INDEX idx_audit_logs_actor_admin ON audit_logs(actor_admin_id, created_at DESC);

CREATE OR REPLACE FUNCTION set_point_from_lat_lng()
RETURNS trigger AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.gps_location := ST_SetSRID(ST_MakePoint(NEW.longitude::double precision, NEW.latitude::double precision), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_incidents_set_gps BEFORE INSERT OR UPDATE OF latitude, longitude ON incidents FOR EACH ROW EXECUTE FUNCTION set_point_from_lat_lng();

CREATE OR REPLACE FUNCTION set_incident_manual_point_from_lat_lng()
RETURNS trigger AS $$
BEGIN
  IF NEW.manual_latitude IS NOT NULL AND NEW.manual_longitude IS NOT NULL THEN
    NEW.manual_gps_location := ST_SetSRID(ST_MakePoint(NEW.manual_longitude::double precision, NEW.manual_latitude::double precision), 4326)::geography;
    NEW.manual_location_adjusted := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_incidents_set_manual_gps BEFORE INSERT OR UPDATE OF manual_latitude, manual_longitude ON incidents FOR EACH ROW EXECUTE FUNCTION set_incident_manual_point_from_lat_lng();
CREATE TRIGGER trg_incident_media_set_gps BEFORE INSERT OR UPDATE OF latitude, longitude ON incident_media FOR EACH ROW EXECUTE FUNCTION set_point_from_lat_lng();
CREATE TRIGGER trg_stolen_vehicle_reports_set_gps BEFORE INSERT OR UPDATE OF latitude, longitude ON stolen_vehicle_reports FOR EACH ROW EXECUTE FUNCTION set_point_from_lat_lng();
CREATE TRIGGER trg_missing_person_reports_set_gps BEFORE INSERT OR UPDATE OF latitude, longitude ON missing_person_reports FOR EACH ROW EXECUTE FUNCTION set_point_from_lat_lng();
CREATE TRIGGER trg_police_stations_set_gps BEFORE INSERT OR UPDATE OF latitude, longitude ON police_stations FOR EACH ROW EXECUTE FUNCTION set_point_from_lat_lng();
CREATE TRIGGER trg_sos_events_set_gps BEFORE INSERT OR UPDATE OF latitude, longitude ON sos_events FOR EACH ROW EXECUTE FUNCTION set_point_from_lat_lng();

CREATE OR REPLACE FUNCTION can_admin_access_incident(admin_id uuid, incident_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM admin_users au
    JOIN incidents i ON i.id = incident_id
    WHERE au.id = admin_id
      AND au.is_active = true
      AND au.country = i.country
      AND au.state = i.state
      AND au.lga = i.lga
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION audit_row_change()
RETURNS trigger AS $$
DECLARE
  actor_user uuid := NULLIF(current_setting('app.actor_user_id', true), '')::uuid;
  actor_admin uuid := NULLIF(current_setting('app.actor_admin_id', true), '')::uuid;
  request_id text := current_setting('app.request_id', true);
  changed_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    changed_id := OLD.id;
  ELSE
    changed_id := NEW.id;
  END IF;

  INSERT INTO audit_logs (
    actor_user_id,
    actor_admin_id,
    actor_type,
    action,
    entity_type,
    entity_id,
    before_state,
    after_state,
    metadata
  ) VALUES (
    actor_user,
    actor_admin,
    CASE WHEN actor_admin IS NOT NULL THEN 'admin' WHEN actor_user IS NOT NULL THEN 'user' ELSE 'system' END,
    lower(TG_OP),
    TG_TABLE_NAME,
    changed_id,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    jsonb_build_object('requestId', request_id)
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_profiles AFTER INSERT OR UPDATE OR DELETE ON profiles FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_kyc_records AFTER INSERT OR UPDATE OR DELETE ON kyc_records FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_emergency_contacts AFTER INSERT OR UPDATE OR DELETE ON emergency_contacts FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_jurisdictions AFTER INSERT OR UPDATE OR DELETE ON jurisdictions FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_agencies AFTER INSERT OR UPDATE OR DELETE ON agencies FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_admin_users AFTER INSERT OR UPDATE OR DELETE ON admin_users FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_incidents AFTER INSERT OR UPDATE OR DELETE ON incidents FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_incident_media AFTER INSERT OR UPDATE OR DELETE ON incident_media FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_incident_verifications AFTER INSERT OR UPDATE OR DELETE ON incident_verifications FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_incident_timeline AFTER INSERT OR UPDATE OR DELETE ON incident_timeline FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_incident_status_history AFTER INSERT OR UPDATE OR DELETE ON incident_status_history FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_broadcasts AFTER INSERT OR UPDATE OR DELETE ON broadcasts FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_vehicles AFTER INSERT OR UPDATE OR DELETE ON vehicles FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_stolen_vehicle_reports AFTER INSERT OR UPDATE OR DELETE ON stolen_vehicle_reports FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_missing_person_reports AFTER INSERT OR UPDATE OR DELETE ON missing_person_reports FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_police_stations AFTER INSERT OR UPDATE OR DELETE ON police_stations FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_notifications AFTER INSERT OR UPDATE OR DELETE ON notifications FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_neighborhood_groups AFTER INSERT OR UPDATE OR DELETE ON neighborhood_groups FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_group_messages AFTER INSERT OR UPDATE OR DELETE ON group_messages FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_live_video_sessions AFTER INSERT OR UPDATE OR DELETE ON live_video_sessions FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_smartwatch_devices AFTER INSERT OR UPDATE OR DELETE ON smartwatch_devices FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_sos_events AFTER INSERT OR UPDATE OR DELETE ON sos_events FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_reports AFTER INSERT OR UPDATE OR DELETE ON reports FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_trusted_reporters AFTER INSERT OR UPDATE OR DELETE ON trusted_reporters FOR EACH ROW EXECUTE FUNCTION audit_row_change();

CREATE OR REPLACE FUNCTION write_incident_status_history()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO incident_status_history (incident_id, from_status, to_status, note)
    VALUES (NEW.id, NULL, NEW.status, 'Incident submitted');
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO incident_status_history (incident_id, from_status, to_status, note)
    VALUES (NEW.id, OLD.status, NEW.status, 'Status changed');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_incidents_status_history AFTER INSERT OR UPDATE OF status ON incidents FOR EACH ROW EXECUTE FUNCTION write_incident_status_history();
CREATE TRIGGER audit_users AFTER INSERT OR UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_admin_roles AFTER INSERT OR UPDATE OR DELETE ON admin_roles FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_incident_media_access_logs AFTER INSERT OR UPDATE OR DELETE ON incident_media_access_logs FOR EACH ROW EXECUTE FUNCTION audit_row_change();

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id text UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  admin_user_id uuid REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  family_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT refresh_tokens_actor_check CHECK (user_id IS NOT NULL OR admin_user_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_expires ON refresh_tokens(user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_admin_expires ON refresh_tokens(admin_user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS phone_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  phone text NOT NULL,
  code_hash text NOT NULL,
  purpose text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_phone_otps_phone_purpose_expires ON phone_otps(phone, purpose, expires_at DESC);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_expires ON password_reset_tokens(user_id, expires_at DESC);

CREATE TRIGGER audit_refresh_tokens AFTER INSERT OR UPDATE OR DELETE ON refresh_tokens FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_phone_otps AFTER INSERT OR UPDATE OR DELETE ON phone_otps FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_password_reset_tokens AFTER INSERT OR UPDATE OR DELETE ON password_reset_tokens FOR EACH ROW EXECUTE FUNCTION audit_row_change();



ALTER TABLE notifications ADD COLUMN IF NOT EXISTS admin_user_id uuid REFERENCES admin_users(id);
CREATE INDEX IF NOT EXISTS idx_notifications_admin_status_created_at ON notifications(admin_user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS escalation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  incident_type "IncidentType",
  priority "IncidentPriority",
  jurisdiction_id uuid REFERENCES jurisdictions(id),
  agency_id uuid REFERENCES agencies(id),
  max_response_time_seconds integer NOT NULL,
  escalation_destination_role text,
  escalation_destination_admin_id uuid REFERENCES admin_users(id),
  escalation_destination_agency_id uuid REFERENCES agencies(id),
  is_active boolean NOT NULL DEFAULT true,
  created_by_admin_id uuid REFERENCES admin_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT escalation_rules_destination_check CHECK (
    escalation_destination_role IS NOT NULL OR escalation_destination_admin_id IS NOT NULL OR escalation_destination_agency_id IS NOT NULL
  ),
  CONSTRAINT escalation_rules_response_time_check CHECK (max_response_time_seconds > 0)
);
CREATE INDEX IF NOT EXISTS idx_escalation_rules_type_priority_active ON escalation_rules(incident_type, priority, is_active);
CREATE INDEX IF NOT EXISTS idx_escalation_rules_jurisdiction_agency_active ON escalation_rules(jurisdiction_id, agency_id, is_active);

CREATE TABLE IF NOT EXISTS incident_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES escalation_rules(id),
  to_admin_id uuid REFERENCES admin_users(id),
  to_agency_id uuid REFERENCES agencies(id),
  destination_role text,
  status "EscalationStatus" NOT NULL DEFAULT 'Pending',
  reason text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  CONSTRAINT incident_escalations_destination_check CHECK (to_admin_id IS NOT NULL OR to_agency_id IS NOT NULL OR destination_role IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_incident_escalations_incident_created_at ON incident_escalations(incident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_escalations_status_created_at ON incident_escalations(status, created_at DESC);

CREATE TRIGGER audit_escalation_rules AFTER INSERT OR UPDATE OR DELETE ON escalation_rules FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_incident_escalations AFTER INSERT OR UPDATE OR DELETE ON incident_escalations FOR EACH ROW EXECUTE FUNCTION audit_row_change();
