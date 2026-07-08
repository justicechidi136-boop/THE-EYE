CREATE TABLE live_video_location_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_video_session_id uuid NOT NULL REFERENCES live_video_sessions(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  latitude numeric(9,6) NOT NULL,
  longitude numeric(9,6) NOT NULL,
  accuracy numeric(8,2),
  speed numeric(8,2),
  heading numeric(8,2),
  altitude numeric(8,2),
  gps_location geography(Point,4326) NOT NULL,
  captured_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  source_device_id text,
  CONSTRAINT live_video_location_latitude_check CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT live_video_location_longitude_check CHECK (longitude BETWEEN -180 AND 180)
);

CREATE INDEX idx_live_video_location_updates_session_captured_at ON live_video_location_updates(live_video_session_id, captured_at DESC);
CREATE INDEX idx_live_video_location_updates_incident_captured_at ON live_video_location_updates(incident_id, captured_at DESC);
CREATE INDEX idx_live_video_location_updates_gps_location ON live_video_location_updates USING gist(gps_location);

CREATE TRIGGER trg_live_video_location_updates_set_gps
BEFORE INSERT OR UPDATE OF latitude, longitude ON live_video_location_updates
FOR EACH ROW EXECUTE FUNCTION set_point_from_lat_lng();

CREATE TRIGGER audit_live_video_location_updates
AFTER INSERT OR UPDATE OR DELETE ON live_video_location_updates
FOR EACH ROW EXECUTE FUNCTION audit_row_change();
