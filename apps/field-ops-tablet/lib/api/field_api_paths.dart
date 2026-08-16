/// API path constants aligned with NestJS `/v1/field/*` routes.
abstract final class FieldApiPaths {
  static const legacyDefaultBaseUrl = String.fromEnvironment(
    'THE_EYE_API_BASE_URL',
    defaultValue: 'http://10.0.2.2:4000/v1',
  );

  // Device registration & heartbeat
  static const deviceChallenge = '/field/devices/challenge';
  static const deviceRegister = '/field/devices/register';
  static const deviceRegistrationStatus = '/field/devices/registration-status';
  static const deviceCompletePairing = '/field/devices/complete-pairing';

  static String deviceHeartbeat(String publicDeviceId) =>
      '/field/devices/$publicDeviceId/heartbeat';

  // Pre-provisioned device pairing (QR / short code) — unauthenticated,
  // rate-limited endpoints. See `FieldDevicePairingService` on the API and
  // `docs/FIELD_DEVICE_PAIRING.md`.
  static const pairingClaim = '/field/pairing/claim';
  static const pairingChallenge = '/field/pairing/challenge';
  static const pairingComplete = '/field/pairing/complete';
  static const pairingStatus = '/field/pairing/status';

  /// Server-authoritative launcher / kiosk policy for this device session.
  static const devicePolicyMe = '/field/devices/me/policy';
  static const deviceLauncherAudit = '/field/devices/me/launcher-audit';

  // Auth
  static const authLogin = '/field/auth/login';
  static const authRefresh = '/field/auth/refresh';
  static const authLogout = '/field/auth/logout';
  static const authLock = '/field/auth/lock';
  static const authUnlock = '/field/auth/unlock';
  static const authSession = '/field/auth/session';

  // Authenticated officer/admin preferences
  static const adminPreferences = '/admin/preferences';

  // Dashboard & telemetry
  static const dashboard = '/field/dashboard';
  static const dashboardTelemetry = '/field/dashboard/telemetry';

  // Shifts
  static const shiftsActive = '/field/shifts/active';
  static const shiftsStart = '/field/shifts/start';
  static const shiftsPause = '/field/shifts/pause';
  static const shiftsResume = '/field/shifts/resume';
  static const shiftsEnd = '/field/shifts/end';

  // Patrols
  static const patrolsActive = '/field/patrols/active';
  static const patrolsStart = '/field/patrols/start';
  static const patrolsPause = '/field/patrols/pause';
  static const patrolsResume = '/field/patrols/resume';
  static const patrolsEnd = '/field/patrols/end';
  static const patrolsLocation = '/field/patrols/location';

  // Checkpoints
  static const checkpointsActive = '/field/checkpoints/active';
  static const checkpointsStart = '/field/checkpoints/start';
  static const checkpointsPause = '/field/checkpoints/pause';
  static const checkpointsResume = '/field/checkpoints/resume';
  static const checkpointsEnd = '/field/checkpoints/end';
  static const checkpointsQueue = '/field/checkpoints/queue';
  static const checkpointsSearch = '/field/checkpoints/search';

  // Assignments & incident workspace
  static const assignmentsMine = '/field/assignments/mine';

  static String assignment(String id) => '/field/assignments/$id';

  static String assignmentLocation(String id) =>
      '/field/assignments/$id/location';

  static String assignmentLiveLocation(String id) =>
      '/field/assignments/$id/live-location';

  static String assignmentBackup(String id) => '/field/assignments/$id/backup';

  static String assignmentTimeline(String id) =>
      '/field/assignments/$id/timeline';

  // Operational responses (incident comms)
  static const responses = '/field/responses';

  static String responsesForAssignment(String assignmentId) =>
      '/field/responses/assignments/$assignmentId';

  // BOLO
  static const boloSearch = '/field/bolo';
  static const boloSightings = '/field/bolo/sightings';

  // Drone
  static const droneMissions = '/field/drone/missions';
  static const droneRequest = '/field/drone/request';

  static String droneMission(String id) => '/field/drone/missions/$id';

  // Offline sync
  static const syncBatch = '/field/sync/batch';

  // Sprint 3 — GIS, events, safety, backup, comms
  static const mapContext = '/field/map/context';
  static const eventsPoll = '/field/events';
  static const safetyPanic = '/field/safety/panic';
  static const safetyOfficerDown = '/field/safety/officer-down';
  static const safetyDistress = '/field/safety/distress';
  static const safetyCheckInSchedule = '/field/safety/check-in/schedule';
  static const backupCreate = '/field/backup';
  static const backupMine = '/field/backup/mine';
  static const patrolEvents = '/field/patrols/events';
  static const checkpointObservations = '/field/checkpoints/observations';
  static const checkpointClosureSummary = '/field/checkpoints/closure-summary';

  static String patrolRouteHistory(String patrolId) =>
      '/field/patrols/$patrolId/route-history';

  static String incidentConversation(String incidentId) =>
      '/field/incidents/$incidentId/conversation';

  static String incidentMessages(String incidentId) =>
      '/field/incidents/$incidentId/messages';

  static String incidentMessageRead(String incidentId, String messageId) =>
      '/field/incidents/$incidentId/messages/$messageId/read';

  static String incidentInformationRequests(String incidentId) =>
      '/field/incidents/$incidentId/information-requests';
}
