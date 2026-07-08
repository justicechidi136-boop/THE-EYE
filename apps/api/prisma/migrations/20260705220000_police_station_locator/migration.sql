ALTER TABLE police_stations
  ADD COLUMN agency_type text NOT NULL DEFAULT 'police',
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

UPDATE police_stations ps
   SET agency_type = COALESCE(a.type, 'police')
  FROM agencies a
 WHERE ps.agency_id = a.id;

CREATE INDEX idx_police_stations_agency_type ON police_stations(agency_type);
CREATE INDEX idx_police_stations_address_search ON police_stations USING gin(to_tsvector('simple', name || ' ' || address || ' ' || agency_type));
