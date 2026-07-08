ALTER TABLE live_video_sessions
  ADD COLUMN created_by_id uuid REFERENCES users(id),
  ADD COLUMN status text NOT NULL DEFAULT 'Active',
  ADD COLUMN low_bandwidth_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN participant_identity text,
  ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX idx_live_video_sessions_status_started_at ON live_video_sessions(status, started_at DESC);
