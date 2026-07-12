-- Scale-oriented btree indexes for hot query paths.
-- GiST spatial indexes already exist from prior migrations; these complement admin,
-- inbox, and geofence-adjacent lookups without changing table shapes.

-- Incidents: citizen history, agency assignment dashboards, jurisdiction admin scope
CREATE INDEX IF NOT EXISTS idx_incidents_reporter_created_at
  ON incidents(reporter_id, created_at DESC)
  WHERE reporter_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_incidents_assigned_agency_status_created_at
  ON incidents(assigned_agency_id, status, created_at DESC)
  WHERE assigned_agency_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_incidents_jurisdiction_status_priority_created_at
  ON incidents(jurisdiction_id, status, priority, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_incidents_country_state_lga_status_created_at
  ON incidents(country, state, lga, status, created_at DESC);

-- Broadcasts: published feed ordering, admin creator scope, user delivery lookups
CREATE INDEX IF NOT EXISTS idx_broadcasts_published_published_at
  ON broadcasts(published_at DESC)
  WHERE status = 'Published';

CREATE INDEX IF NOT EXISTS idx_broadcasts_creator_admin_id
  ON broadcasts(creator_admin_id)
  WHERE creator_admin_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_broadcast_deliveries_user_broadcast_id
  ON broadcast_deliveries(user_id, broadcast_id);

-- Community posts: feeds, moderation queues, admin community directory
CREATE INDEX IF NOT EXISTS idx_community_posts_author_created_at
  ON community_posts(author_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_posts_community_verification_created_at
  ON community_posts(community_id, verification_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_communities_country_state_lga_created_at
  ON communities(country, state, lga, created_at DESC);

-- Notifications: unread inboxes and broadcast linkage
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_created_at
  ON notifications(user_id, created_at DESC)
  WHERE read_at IS NULL AND user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_admin_unread_created_at
  ON notifications(admin_user_id, created_at DESC)
  WHERE read_at IS NULL AND admin_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_broadcast_id
  ON notifications(broadcast_id)
  WHERE broadcast_id IS NOT NULL;

-- Admin jurisdiction: agency-scoped operator lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_agency_active
  ON admin_users(agency_id, is_active)
  WHERE agency_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_users_country_state_lga_active
  ON admin_users(country, state, lga, is_active)
  WHERE is_active = true;
