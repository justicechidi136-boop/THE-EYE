CREATE TYPE "CommunityLevel" AS ENUM ('Country', 'State', 'LGA', 'Ward', 'Community', 'Estate', 'Street');
CREATE TYPE "CommunityVisibility" AS ENUM ('Public', 'Private');
CREATE TYPE "CommunityMembershipStatus" AS ENUM ('Pending', 'Approved', 'Rejected', 'Left', 'Suspended');
CREATE TYPE "CommunityRoleName" AS ENUM ('CommunityModerator', 'EstateAdmin', 'SecurityCoordinator', 'PoliceLiaison', 'VolunteerCoordinator', 'VerifiedVolunteer', 'Resident');
CREATE TYPE "CommunityPostType" AS ENUM ('SuspiciousActivity', 'LostChild', 'MissingPerson', 'CrimeAlert', 'AccidentAlert', 'FireAlert', 'FloodWarning', 'CommunityAnnouncement', 'SecurityMeeting', 'PatrolUpdate');
CREATE TYPE "CommunityVerificationStatus" AS ENUM ('PendingVerification', 'Verified', 'Disputed', 'FalseInformation');
CREATE TYPE "CommunityReactionType" AS ENUM ('Confirm', 'Helpful', 'Praying', 'Dispute', 'Seen');
CREATE TYPE "CommunityChannelType" AS ENUM ('General', 'Emergency', 'Security', 'Volunteers', 'WomenSafety', 'Parents', 'BusinessOwners');
CREATE TYPE "VolunteerType" AS ENUM ('Doctor', 'Nurse', 'FirstAid', 'Lawyer', 'SecurityVolunteer', 'FireVolunteer', 'SearchAndRescue', 'BloodDonor');
CREATE TYPE "PatrolStatus" AS ENUM ('Scheduled', 'Active', 'Completed', 'Cancelled');

CREATE TABLE communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES communities(id),
  jurisdiction_id uuid REFERENCES jurisdictions(id),
  name text NOT NULL,
  level "CommunityLevel" NOT NULL,
  visibility "CommunityVisibility" NOT NULL DEFAULT 'Public',
  country text NOT NULL,
  state text,
  lga text,
  ward text,
  estate text,
  street text,
  description text,
  boundary geography(MultiPolygon,4326),
  center geography(Point,4326),
  created_by_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_communities_parent_id ON communities(parent_id);
CREATE INDEX idx_communities_country_state_lga_ward ON communities(country, state, lga, ward);
CREATE INDEX idx_communities_level_visibility ON communities(level, visibility);
CREATE INDEX idx_communities_boundary ON communities USING gist(boundary);
CREATE INDEX idx_communities_center ON communities USING gist(center);

CREATE TABLE community_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  name "CommunityRoleName" NOT NULL,
  permissions text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (community_id, name)
);
CREATE INDEX idx_community_roles_name ON community_roles(name);

CREATE TABLE community_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id uuid REFERENCES community_roles(id),
  status "CommunityMembershipStatus" NOT NULL DEFAULT 'Pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_by_id uuid,
  approved_at timestamptz,
  left_at timestamptz,
  UNIQUE (community_id, user_id)
);
CREATE INDEX idx_community_memberships_user_status ON community_memberships(user_id, status);
CREATE INDEX idx_community_memberships_community_status ON community_memberships(community_id, status);

CREATE TABLE community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  incident_id uuid REFERENCES incidents(id),
  broadcast_id uuid REFERENCES broadcasts(id),
  type "CommunityPostType" NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  verification_status "CommunityVerificationStatus" NOT NULL DEFAULT 'PendingVerification',
  confidence_score numeric(5,2) NOT NULL DEFAULT 0.00,
  latitude numeric(9,6),
  longitude numeric(9,6),
  gps_location geography(Point,4326),
  is_escalated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_community_posts_community_created_at ON community_posts(community_id, created_at DESC);
CREATE INDEX idx_community_posts_verification_confidence ON community_posts(verification_status, confidence_score);
CREATE INDEX idx_community_posts_incident_id ON community_posts(incident_id);
CREATE INDEX idx_community_posts_broadcast_id ON community_posts(broadcast_id);
CREATE INDEX idx_community_posts_gps_location ON community_posts USING gist(gps_location);

CREATE TABLE community_post_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL REFERENCES users(id),
  media_type "MediaType" NOT NULL,
  bucket text NOT NULL,
  object_key text NOT NULL,
  content_type text NOT NULL,
  file_hash text NOT NULL UNIQUE,
  captured_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_community_post_media_post_id ON community_post_media(post_id);

CREATE TABLE community_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_community_post_comments_post_created_at ON community_post_comments(post_id, created_at);

CREATE TABLE community_post_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type "CommunityReactionType" NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id, type)
);
CREATE INDEX idx_community_post_reactions_post_type ON community_post_reactions(post_id, type);

CREATE TABLE community_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  verifier_id uuid REFERENCES users(id),
  status "CommunityVerificationStatus" NOT NULL,
  confidence numeric(5,2) NOT NULL,
  signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_community_verifications_post_created_at ON community_verifications(post_id, created_at);
CREATE INDEX idx_community_verifications_status_confidence ON community_verifications(status, confidence);

CREATE TABLE community_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  type "CommunityChannelType" NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (community_id, type)
);

CREATE TABLE community_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES community_channels(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_community_messages_channel_created_at ON community_messages(channel_id, created_at);

CREATE TABLE volunteer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  community_id uuid REFERENCES communities(id),
  types "VolunteerType"[] NOT NULL DEFAULT ARRAY[]::"VolunteerType"[],
  verified boolean NOT NULL DEFAULT false,
  available boolean NOT NULL DEFAULT true,
  latitude numeric(9,6),
  longitude numeric(9,6),
  gps_location geography(Point,4326),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_volunteer_profiles_community_verified_available ON volunteer_profiles(community_id, verified, available);
CREATE INDEX idx_volunteer_profiles_gps_location ON volunteer_profiles USING gist(gps_location);

CREATE TABLE patrol_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  title text NOT NULL,
  status "PatrolStatus" NOT NULL DEFAULT 'Scheduled',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  route geography(LineString,4326),
  created_by_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_patrol_schedules_community_status_starts_at ON patrol_schedules(community_id, status, starts_at);
CREATE INDEX idx_patrol_schedules_route ON patrol_schedules USING gist(route);

CREATE TABLE patrol_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES patrol_schedules(id) ON DELETE CASCADE,
  volunteer_id uuid NOT NULL REFERENCES volunteer_profiles(id),
  user_id uuid NOT NULL REFERENCES users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (schedule_id, user_id)
);

CREATE TABLE patrol_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES patrol_schedules(id) ON DELETE CASCADE,
  submitted_by_id uuid NOT NULL REFERENCES users(id),
  label text NOT NULL,
  latitude numeric(9,6) NOT NULL,
  longitude numeric(9,6) NOT NULL,
  gps_location geography(Point,4326) NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_patrol_checkpoints_schedule_checked_at ON patrol_checkpoints(schedule_id, checked_at);
CREATE INDEX idx_patrol_checkpoints_gps_location ON patrol_checkpoints USING gist(gps_location);

CREATE TABLE patrol_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES patrol_schedules(id) ON DELETE CASCADE,
  submitted_by_id uuid NOT NULL REFERENCES users(id),
  summary text NOT NULL,
  issues_found boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_patrol_reports_schedule_created_at ON patrol_reports(schedule_id, created_at);

ALTER TABLE notifications ADD COLUMN community_id uuid REFERENCES communities(id);
CREATE INDEX idx_notifications_community_created_at ON notifications(community_id, created_at DESC);

UPDATE admin_roles
   SET permissions = permissions || ARRAY['community:read','community:moderate','community:verify','community:patrol']
 WHERE name IN ('Super Admin', 'Country Admin', 'State Admin', 'LGA Admin')
   AND NOT ('community:read' = ANY(permissions));
