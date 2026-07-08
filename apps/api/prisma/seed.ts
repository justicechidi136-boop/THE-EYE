import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/common/auth/crypto";

const prisma = new PrismaClient();

async function main() {
  const jurisdictionId = "11111111-1111-1111-1111-111111111111";
  const policeAgencyId = "22222222-2222-2222-2222-222222222222";
  const emergencyAgencyId = "22222222-2222-2222-2222-222222222223";
  const adminRoleId = "33333333-3333-3333-3333-333333333333";
  const dispatcherRoleId = "33333333-3333-3333-3333-333333333334";
  const seedPasswordHash = hashPassword("Password123!");
  const adminUserId = "44444444-4444-4444-4444-444444444444";
  const superAdminUserId = "44444444-4444-4444-4444-444444444445";
  const citizenId = "55555555-5555-5555-5555-555555555555";
  const incidentId = "66666666-6666-6666-6666-666666666666";
  const mediaId = "77777777-7777-7777-7777-777777777777";
  const vehicleId = "88888888-8888-8888-8888-888888888888";
  const groupId = "99999999-9999-9999-9999-999999999999";
  const watchId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const broadcastId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const communityId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
  const communityRoleId = "dddddddd-dddd-dddd-dddd-dddddddddddd";
  const communityPostId = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
  const patrolId = "ffffffff-ffff-ffff-ffff-ffffffffffff";

  await prisma.$executeRawUnsafe(`
    INSERT INTO admin_roles (id, name, permissions) VALUES
      ('${adminRoleId}', 'Super Admin', ARRAY['incident:create','incident:read','incident:update','incident:assign','incident:escalate','broadcast:create','broadcast:approve','broadcast:publish','community:read','community:moderate','community:verify','community:patrol','audit:read','user:manage','agency:manage','auth:admin']),
      ('${dispatcherRoleId}', 'Call Center Agent', ARRAY['incident:create','incident:read','incident:update','auth:admin']),
      (gen_random_uuid(), 'Country Admin', ARRAY['incident:read','incident:update','incident:assign','incident:escalate','broadcast:create','broadcast:approve','broadcast:publish','audit:read','user:manage','agency:manage','auth:admin']),
      (gen_random_uuid(), 'State Admin', ARRAY['incident:read','incident:update','incident:assign','incident:escalate','broadcast:create','broadcast:publish','audit:read','user:manage','agency:manage','auth:admin']),
      (gen_random_uuid(), 'LGA Admin', ARRAY['incident:read','incident:update','incident:assign','broadcast:create','audit:read','user:manage','auth:admin']),
      (gen_random_uuid(), 'Agency Admin', ARRAY['incident:read','incident:update','incident:assign','incident:escalate','audit:read','user:manage','auth:admin']),
      (gen_random_uuid(), 'Police/Security Officer', ARRAY['incident:read','incident:update','auth:admin']),
      (gen_random_uuid(), 'Oversight Auditor', ARRAY['incident:read','audit:read','auth:admin'])
    ON CONFLICT (name) DO NOTHING;

    INSERT INTO jurisdictions (id, country, state, lga, name, boundary) VALUES
      ('${jurisdictionId}', 'Nigeria', 'Lagos', 'Ikeja', 'Ikeja LGA', ST_GeogFromText('SRID=4326;MULTIPOLYGON(((3.30 6.55,3.45 6.55,3.45 6.70,3.30 6.70,3.30 6.55)))'))
    ON CONFLICT (country, state, lga) DO NOTHING;

    INSERT INTO agencies (id, jurisdiction_id, name, type, phone, email) VALUES
      ('${policeAgencyId}', '${jurisdictionId}', 'Ikeja Police Command', 'police', '+2348000001001', 'ikeja.police@example.gov'),
      ('${emergencyAgencyId}', '${jurisdictionId}', 'Lagos Emergency Response Unit', 'emergency', '+2348000001002', 'ikeja.emergency@example.gov')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO escalation_rules (name, incident_type, priority, jurisdiction_id, agency_id, max_response_time_seconds, escalation_destination_role, escalation_destination_agency_id, created_by_admin_id) VALUES
      ('P1 agency acknowledgement SLA', NULL, 'P1LifeThreatening', '${jurisdictionId}', '${policeAgencyId}', 300, 'Super Admin', '${emergencyAgencyId}', NULL),
      ('P2 active incident acknowledgement SLA', NULL, 'P2ActiveCrimeAccident', '${jurisdictionId}', '${policeAgencyId}', 900, 'State Admin', '${emergencyAgencyId}', NULL)
    ON CONFLICT DO NOTHING;

    INSERT INTO admin_users (id, role_id, agency_id, jurisdiction_id, email, password_hash, display_name, country, state, lga) VALUES
      ('${superAdminUserId}', '${adminRoleId}', NULL, '${jurisdictionId}', 'superadmin@theeye.local', '${seedPasswordHash}', 'THE EYE Super Admin', 'Nigeria', 'Lagos', 'Ikeja'),
      ('${adminUserId}', '${dispatcherRoleId}', '${policeAgencyId}', '${jurisdictionId}', 'dispatcher.ikeja@theeye.local', '${seedPasswordHash}', 'Ikeja Dispatcher', 'Nigeria', 'Lagos', 'Ikeja')
    ON CONFLICT (email) DO NOTHING;

    INSERT INTO users (id, email, phone, password_hash, is_trusted_reporter) VALUES
      ('${citizenId}', 'citizen@theeye.local', '+2348000002001', '${seedPasswordHash}', true)
    ON CONFLICT (email) DO NOTHING;

    INSERT INTO profiles (user_id, first_name, last_name, country, state, lga, address) VALUES
      ('${citizenId}', 'Amina', 'Okafor', 'Nigeria', 'Lagos', 'Ikeja', 'Allen Avenue, Ikeja')
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO trusted_reporters (user_id, trust_score, verification_level, reports_submitted, reports_verified) VALUES
      ('${citizenId}', 92.50, 'KYCVerified', 12, 10)
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO kyc_records (user_id, document_type, document_number, document_hash, status, reviewed_by, reviewed_at) VALUES
      ('${citizenId}', 'NationalID', 'SEED-NIN-001', 'sha256:seed-kyc-document', 'Verified', '${adminUserId}', now())
    ON CONFLICT DO NOTHING;

    INSERT INTO emergency_contacts (user_id, name, phone, relationship, priority) VALUES
      ('${citizenId}', 'Chinedu Okafor', '+2348000002002', 'Brother', 1)
    ON CONFLICT DO NOTHING;

    INSERT INTO police_stations (agency_id, jurisdiction_id, name, phone, address, agency_type, latitude, longitude, gps_location) VALUES
      ('${policeAgencyId}', '${jurisdictionId}', 'Ikeja Central Police Station', '+2348000003001', 'Ikeja, Lagos', 'police', 6.601800, 3.351500, ST_SetSRID(ST_MakePoint(3.351500, 6.601800), 4326)::geography),
      ('${policeAgencyId}', '${jurisdictionId}', 'Alausa Security Post', '+2348000003002', 'Alausa Secretariat Road, Ikeja', 'security', 6.617200, 3.358900, ST_SetSRID(ST_MakePoint(3.358900, 6.617200), 4326)::geography)
    ON CONFLICT DO NOTHING;

    INSERT INTO incidents (id, reporter_id, jurisdiction_id, assigned_agency_id, assigned_admin_id, type, status, priority, title, description, address, country, state, lga, latitude, longitude, gps_location, metadata) VALUES
      ('${incidentId}', '${citizenId}', '${jurisdictionId}', '${policeAgencyId}', '${adminUserId}', 'Crime', 'Received', 'P2ActiveCrimeAccident', 'Armed robbery reported near Allen Avenue', 'Citizen reported an active robbery with two suspects fleeing by motorcycle.', 'Allen Avenue, Ikeja', 'Nigeria', 'Lagos', 'Ikeja', 6.601200, 3.351400, ST_SetSRID(ST_MakePoint(3.351400, 6.601200), 4326)::geography, '{"source":"seed","confidence":"medium"}'::jsonb)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO incident_timeline (incident_id, actor_id, actor_type, event_type, message, metadata) VALUES
      ('${incidentId}', '${citizenId}', 'user', 'incident.submitted', 'Citizen submitted a crime report.', '{"channel":"mobile"}'::jsonb),
      ('${incidentId}', NULL, 'system', 'incident.received', 'Incident received by command center.', '{}'::jsonb)
    ON CONFLICT DO NOTHING;

    INSERT INTO incident_verifications (incident_id, verifier_id, method, result, confidence, notes) VALUES
      ('${incidentId}', '${citizenId}', 'trusted_reporter', 'needs_dispatcher_review', 75.00, 'Reporter has high trust score but incident needs dispatcher confirmation.')
    ON CONFLICT DO NOTHING;

    INSERT INTO incident_media (id, incident_id, uploader_id, media_type, bucket, object_key, content_type, size_bytes, file_hash, captured_at, uploaded_at, latitude, longitude, gps_location, metadata) VALUES
      ('${mediaId}', '${incidentId}', '${citizenId}', 'Image', 'the-eye', 'evidence/seed/robbery-photo.jpg', 'image/jpeg', 204800, 'sha256:seed-evidence-photo', now(), now(), 6.601180, 3.351390, ST_SetSRID(ST_MakePoint(3.351390, 6.601180), 4326)::geography, '{"device":"seed-camera"}'::jsonb)
    ON CONFLICT (file_hash) DO NOTHING;

    INSERT INTO incident_media_access_logs (media_id, admin_user_id, action, reason, ip_address, user_agent) VALUES
      ('${mediaId}', '${adminUserId}', 'view', 'Initial dispatcher verification', '127.0.0.1', 'seed-script')
    ON CONFLICT DO NOTHING;

    INSERT INTO vehicles (id, owner_id, plate_number, vin, make, model, color, year) VALUES
      ('${vehicleId}', '${citizenId}', 'LAG-123-EYE', 'SEEDVIN000000001', 'Toyota', 'Corolla', 'Silver', 2018)
    ON CONFLICT (plate_number) DO NOTHING;

    INSERT INTO stolen_vehicle_reports (vehicle_id, reporter_id, incident_id, status, last_seen_at, last_seen_area, latitude, longitude, gps_location) VALUES
      ('${vehicleId}', '${citizenId}', '${incidentId}', 'Open', now(), 'Allen Avenue, Ikeja', 6.601200, 3.351400, ST_SetSRID(ST_MakePoint(3.351400, 6.601200), 4326)::geography)
    ON CONFLICT DO NOTHING;

    INSERT INTO missing_person_reports (reporter_id, incident_id, full_name, age, gender, description, last_seen_at, last_seen_address, latitude, longitude, gps_location, status) VALUES
      ('${citizenId}', '${incidentId}', 'Seed Missing Person', 17, 'Unknown', 'Seed record for missing-person workflow validation.', now(), 'Ikeja Bus Terminal', 6.603000, 3.350000, ST_SetSRID(ST_MakePoint(3.350000, 6.603000), 4326)::geography, 'Open')
    ON CONFLICT DO NOTHING;

    INSERT INTO broadcasts (id, jurisdiction_id, incident_id, creator_admin_id, approver_admin_id, type, title, body, status, priority, requires_approval, auto_published, target_radius_meters, target_center, target_area, published_at, expires_at) VALUES
      ('${broadcastId}', '${jurisdictionId}', '${incidentId}', '${adminUserId}', '${adminUserId}', 'Crime', 'Safety alert for Allen Avenue', 'Security teams are responding to an active report. Avoid the area and follow official instructions.', 'Published', 'P2ActiveCrimeAccident', true, false, 3000, ST_SetSRID(ST_MakePoint(3.351400, 6.601200), 4326)::geography, ST_Multi(ST_Buffer(ST_SetSRID(ST_MakePoint(3.351400, 6.601200), 4326)::geography, 3000)::geometry)::geography, now(), now() + interval '6 hours')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO notifications (user_id, incident_id, broadcast_id, channel, title, body, status, provider, sent_at) VALUES
      ('${citizenId}', '${incidentId}', '${broadcastId}', 'push', 'Incident received', 'Your report has been received by THE EYE command center.', 'Sent', 'fcm', now())
    ON CONFLICT DO NOTHING;

    INSERT INTO broadcast_deliveries (broadcast_id, user_id, distance_meters, status, channel, sent_at) VALUES
      ('${broadcastId}', '${citizenId}', 145.50, 'Sent', 'push', now())
    ON CONFLICT (broadcast_id, user_id) DO NOTHING;

    INSERT INTO neighborhood_groups (id, jurisdiction_id, name, description, created_by_id) VALUES
      ('${groupId}', '${jurisdictionId}', 'Ikeja Community Watch', 'Verified community safety group for Ikeja residents.', '${citizenId}')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO group_messages (group_id, sender_id, message) VALUES
      ('${groupId}', '${citizenId}', 'Please avoid Allen Avenue while responders verify the report.')
    ON CONFLICT DO NOTHING;

    INSERT INTO communities (id, jurisdiction_id, name, level, visibility, country, state, lga, ward, estate, street, description, center, boundary, created_by_id) VALUES
      ('${communityId}', '${jurisdictionId}', 'Allen Avenue Estate', 'Estate', 'Private', 'Nigeria', 'Lagos', 'Ikeja', 'Ward C', 'Allen Estate', 'Gate 2 Street', 'Seed Neighborhood Watch community for estate safety workflows.', ST_SetSRID(ST_MakePoint(3.351400, 6.601200), 4326)::geography, ST_Multi(ST_Buffer(ST_SetSRID(ST_MakePoint(3.351400, 6.601200), 4326)::geography, 1500)::geometry)::geography, '${adminUserId}')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO community_roles (id, community_id, name, permissions) VALUES
      ('${communityRoleId}', '${communityId}', 'CommunityModerator', ARRAY['community:moderate','community:verify','community:patrol']),
      (gen_random_uuid(), '${communityId}', 'Resident', ARRAY['community:read','community:post'])
    ON CONFLICT (community_id, name) DO NOTHING;

    INSERT INTO community_memberships (community_id, user_id, role_id, status, approved_by_id, approved_at) VALUES
      ('${communityId}', '${citizenId}', '${communityRoleId}', 'Approved', '${adminUserId}', now())
    ON CONFLICT (community_id, user_id) DO NOTHING;

    INSERT INTO community_channels (community_id, type, name) VALUES
      ('${communityId}', 'General', 'General'),
      ('${communityId}', 'Emergency', 'Emergency'),
      ('${communityId}', 'Security', 'Security'),
      ('${communityId}', 'Volunteers', 'Volunteers'),
      ('${communityId}', 'WomenSafety', 'Women Safety'),
      ('${communityId}', 'Parents', 'Parents'),
      ('${communityId}', 'BusinessOwners', 'Business Owners')
    ON CONFLICT (community_id, type) DO NOTHING;

    INSERT INTO community_posts (id, community_id, author_id, incident_id, type, title, body, verification_status, confidence_score, latitude, longitude, gps_location, is_escalated) VALUES
      ('${communityPostId}', '${communityId}', '${citizenId}', '${incidentId}', 'SuspiciousActivity', 'Two unknown riders circling Gate 2', 'Residents reported two riders repeatedly circling Gate 2 and slowing near parked vehicles.', 'PendingVerification', 64.00, 6.601200, 3.351400, ST_SetSRID(ST_MakePoint(3.351400, 6.601200), 4326)::geography, false)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO community_verifications (post_id, verifier_id, status, confidence, signals, note) VALUES
      ('${communityPostId}', '${citizenId}', 'PendingVerification', 64.00, '{"reporterTrust":92.5,"locationMatch":true,"mediaEvidence":false,"moderatorConfirmed":false}'::jsonb, 'Awaiting moderator confirmation.')
    ON CONFLICT DO NOTHING;

    INSERT INTO volunteer_profiles (user_id, community_id, types, verified, available, latitude, longitude, gps_location) VALUES
      ('${citizenId}', '${communityId}', ARRAY['SecurityVolunteer','FirstAid']::"VolunteerType"[], true, true, 6.601200, 3.351400, ST_SetSRID(ST_MakePoint(3.351400, 6.601200), 4326)::geography)
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO patrol_schedules (id, community_id, title, status, starts_at, ends_at, created_by_id) VALUES
      ('${patrolId}', '${communityId}', 'Gate 2 evening patrol', 'Scheduled', now() + interval '2 hours', now() + interval '4 hours', '${citizenId}')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO live_video_sessions (incident_id, room_name, livekit_room_id, created_by_id, status, low_bandwidth_mode, participant_identity, started_at, metadata) VALUES
      ('${incidentId}', 'incident-${incidentId}', 'seed-livekit-room', '${citizenId}', 'Active', true, 'user-${citizenId}', now(), '{"source":"seed","quality":"low-bandwidth"}'::jsonb)
    ON CONFLICT (room_name) DO NOTHING;

    INSERT INTO smartwatch_devices (id, user_id, device_id, provider, last_seen_at) VALUES
      ('${watchId}', '${citizenId}', 'watch-seed-001', 'generic', now())
    ON CONFLICT (device_id) DO NOTHING;

    INSERT INTO sos_events (user_id, device_id, incident_id, latitude, longitude, gps_location) VALUES
      ('${citizenId}', '${watchId}', '${incidentId}', 6.601200, 3.351400, ST_SetSRID(ST_MakePoint(3.351400, 6.601200), 4326)::geography)
    ON CONFLICT DO NOTHING;

    INSERT INTO reports (incident_id, generated_by_id, title, report_type, status, storage_bucket, storage_key) VALUES
      ('${incidentId}', '${adminUserId}', 'Seed Incident Summary', 'incident_summary', 'Generated', 'the-eye', 'reports/seed/incident-summary.pdf')
    ON CONFLICT DO NOTHING;
  `);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });








