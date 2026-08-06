import { AdminRoleName } from "@the-eye/shared";

/** Platform admin roles — canonical source is @the-eye/shared AdminRoleName */
export type AdminRole = AdminRoleName;

export const ALL_ADMIN_ROLES = Object.values(AdminRoleName);

export type Incident = {
  id: string;
  type: string;
  title: string;
  description: string;
  priority: "P1" | "P2" | "P3" | "P4";
  status: string;
  confidenceScore: number;
  createdAt?: string;
  gps: { lat: number; lng: number; accuracy: string };
  reporterStatus: string;
  reportingMode: "Anonymous" | "Identified";
  assignedAgency: string;
  responseStatus: string;
  location: string;
  timeline: Array<{ time: string; event: string; actor: string }>;
  evidence: Array<{
    id: string;
    type: string;
    name: string;
    hash: string;
    contentType?: string;
    durationSeconds?: number | null;
    transcriptionStatus?: string | null;
    transcript?: string | null;
    translatedTranscript?: string | null;
    selectedLanguage?: string | null;
    detectedLanguage?: string | null;
    transcriptionConfidence?: number | null;
    uploadedAt?: string | null;
  }>;
};

export type MissingPersonCaseView = {
  incidentId: string;
  reportId?: string;
  fullName: string;
  age?: number;
  gender?: string;
  description: string;
  lastSeenAt?: string;
  lastSeenAddress?: string;
  reportStatus: string;
  incidentStatus: string;
  priority: Incident["priority"];
  title: string;
  location: string;
  createdAt?: string;
  latitude?: number;
  longitude?: number;
};

export type StolenVehicleCaseView = {
  incidentId: string;
  reportId?: string;
  plateNumber: string;
  vin?: string;
  make: string;
  model: string;
  color?: string;
  year?: number;
  lastSeenAt?: string;
  lastSeenArea?: string;
  reportStatus: string;
  incidentStatus: string;
  priority: Incident["priority"];
  title: string;
  location: string;
  createdAt?: string;
  latitude?: number;
  longitude?: number;
};

export type PoliceStationView = {
  id: string;
  name: string;
  phone: string;
  officialPhone: string;
  emergencyPhone: string;
  address: string;
  country: string;
  state: string;
  lga: string;
  latitude: number;
  longitude: number;
  agencyType: string;
  stationType: string;
  distance: string;
  navigationUrl: string;
  verificationStatus: string;
  isActive: boolean;
  source: string;
  sourceReference: string;
  googlePlaceId: string | null;
  verifiedAt: string | null;
};

export type DuplicateReportView = {
  id: string;
  title: string;
  distance: string;
  confidence: number;
};

export type WitnessConfirmationView = {
  id: string;
  verifierName: string;
  method: string;
  result: string;
  confidence: number | null;
  notes: string | null;
  createdAt: string;
};

export type EvidenceAccessEntry = {
  actor: string;
  file: string;
  action: string;
  time: string;
};

export type DashboardChartPoint = {
  month: string;
  reports: number;
  users: number;
  videos: number;
};

export type AgencySummaryView = {
  name: string;
  type: string;
  jurisdiction: string;
  activeIncidents: number;
};

export type RoleMatrixRow = {
  role: string;
  scope: string;
  incidentAccess: string;
  canModifyIncidents: string;
  communityAccess: string;
  auditAccess: string;
};

export type BroadcastView = {
  id: string;
  type: string;
  title: string;
  severity: string;
  status: string;
  target: string;
  author: string;
  authorLabel: "Citizen" | "Admin" | "Verified";
  requiresApproval: boolean;
  recipients: number;
  delivery: string;
  scheduledAt: string | null;
  schedulingState: string;
  dispatchFailureReason: string | null;
  autoDispatchStatus: string;
  adminVerified: boolean;
  reportCount: number;
  commentCount: number;
  country: string | null;
  state: string | null;
  suspendedReason: string | null;
  createdAt: string | null;
};

export type BroadcastDetailView = BroadcastView & {
  body: string;
  incidentId: string | null;
  publishedAt: string | null;
  resolvedAt: string | null;
  suspendedAt: string | null;
};

export type BroadcastReportView = {
  id: string;
  broadcastId: string;
  reason: string;
  details: string;
  status: string;
  createdAt: string | null;
};

export type BroadcastAnalyticsView = {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  byAuthorLabel: Record<string, number>;
  suspended: number;
  verified: number;
  totalReports: number;
  totalComments: number;
  citizenSubmitted: number;
};

export type UserDirectoryEntry = {
  id: string;
  name: string;
  role: string;
  status: string;
  scope: string;
};

export type AuditLogView = {
  sequence: string;
  time: string;
  actor: string;
  action: string;
  entity: string;
  reason: string;
  previousHash: string;
  eventHash: string;
  chain: string;
};

export type CommunityView = {
  id: string;
  name: string;
  level: string;
  visibility: string;
  status?: string;
  description?: string;
  country?: string;
  state?: string;
  lga?: string;
  hierarchy: string;
  members: number;
  pending: number;
  posts: number;
  confidence: number;
};

export type CommunityPostView = {
  id: string;
  community: string;
  communityId?: string;
  type: string;
  title: string;
  status: string;
  confidence: number;
  linkedIncident: string;
  author: string;
  location: string;
};

export type ResidentView = {
  id: string;
  membershipId: string;
  communityId: string;
  community: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  role: string;
  trustScore: number;
  volunteerStatus: string;
  smartwatchStatus: string;
};

export type VolunteerView = {
  id?: string;
  name: string;
  type: string;
  community: string;
  status: string;
  distance: string;
  latitude?: number;
  longitude?: number;
};

export type PatrolScheduleView = {
  id: string;
  title: string;
  community: string;
  communityId?: string;
  status: string;
  volunteers: number;
  checkpoints: number;
  startsAt?: string;
  endsAt?: string;
  latitude?: number;
  longitude?: number;
};

export type WatchOwnerSummaryView = {
  ownerKey: string;
  ownerType: string;
  ownerId: string | null;
  ownerName: string;
  phone: string | null;
  email: string | null;
  organization: string | null;
  department: string | null;
  currentAssignee: string | null;
  totalWatches: number;
  onlineWatches: number;
  offlineWatches: number;
  lowBatteryWatches: number;
  sosActiveWatches: number;
  unassignedWatches: number;
  lostStolenWatches: number;
  replacementPendingWatches: number;
  retiredWatches: number;
  lastDeviceActivity: string | null;
  accountStatus: string | null;
};

export type WatchInventoryRowView = {
  id: string;
  watchName: string;
  deviceId: string;
  serialNumber: string | null;
  imei: string | null;
  eid: string | null;
  model: string | null;
  manufacturer: string | null;
  firmwareVersion: string | null;
  appVersion: string | null;
  currentOwner: string;
  currentAssignee: string | null;
  organization: string | null;
  department: string | null;
  pairingStatus: string;
  ownershipStatus: string;
  inventoryStatus: string;
  onlineStatus: string;
  batteryLevel: number | null;
  connectivityType: string;
  lastSeen: string | null;
  lastSync: string | null;
  lastKnownState: string | null;
  lastKnownLga: string | null;
  lastSos: string | null;
  lastEmergencyAlert: string | null;
  lastLiveVideoSession: string | null;
};

export type WatchOwnerDetailView = WatchOwnerSummaryView & {
  ownershipHistory?: unknown[];
  assignmentHistory?: unknown[];
  transferHistory?: unknown[];
  auditHistory?: unknown[];
  departments?: unknown[];
};

export type SmartwatchDeviceView = {
  id: string;
  deviceId: string;
  owner: string;
  provider: string;
  model: string;
  mode: string;
  preferredMode: string;
  pairingMethod: string;
  status: string;
  battery: number;
  signal: number;
  firmware: string;
  firmwareSignatureStatus: string;
  security: string;
  alerts: string;
  isActive: boolean;
  lastSeen: string;
  lastGps: { lat: number; lng: number; accuracy: string };
  lastGpsAt?: string;
};

export type SmartwatchDeviceDetailView = SmartwatchDeviceView & {
  sosEvents: SosEventView[];
  gpsTracks: Array<{ lat: number; lng: number; accuracy: string; capturedAt: string }>;
  firmwareUpdates: Array<{ version: string; status: string; startedAt: string }>;
};

export type FieldDeviceView = {
  id: string;
  publicDeviceId: string;
  deviceName: string;
  manufacturer: string;
  model: string;
  registrationStatus: string;
  assignedUserId: string | null;
  agencyId: string | null;
  assignedUnitId: string | null;
  countryCode: string | null;
  stateCode: string | null;
  lgaCode: string | null;
  appVersion: string;
  androidVersion: string;
  lastSeen: string;
  batteryLevel: number | null;
  networkType: string;
  isLost: boolean;
  isRevoked: boolean;
  requiresRePair: boolean;
  isRootRiskDetected: boolean;
  approvedAt: string | null;
  registeredAt: string;
};

export type PairingSessionView = {
  id: string;
  deviceId: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  owner: string;
  connectivityMode: string;
  deviceInternalId: string | null;
  isDeviceRegistered: boolean;
  isDeviceActive: boolean;
};

export type ActivationHistoryView = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  metadata: string;
};

export type FirmwareReleaseView = {
  version: string;
  title: string;
  status: string;
  signature: string;
  devices: number;
  rollback: string;
};

export type DangerZoneView = {
  id: string;
  incidentId: string;
  incidentTitle: string;
  status: string;
  severity: string;
  innerRadiusMeters: number;
  warningRadiusMeters: number;
  outerAwarenessRadiusMeters: number;
  confidence: number;
  publicMessage: string;
  avoidanceInstruction: string;
  expiryTime: string | null;
  affectedCount?: number;
};

export type SosEventView = {
  id: string;
  incidentId: string;
  user: string;
  deviceId: string;
  status: string;
  sourceMode: string;
  priority: string;
  triggeredAt: string;
  familyAlerted: string;
  response: string;
  gps: { lat: number; lng: number; accuracy: string };
};

export type NotificationOperationView = {
  id: string;
  title: string;
  type: string;
  channel: string;
  provider: string;
  priority: string;
  target: string;
  status: string;
  read: string;
  logs: number;
};

export type LiveVideoSessionView = {
  id: string;
  incidentId: string;
  roomName: string;
  status: string;
  startedAt: string;
  date: string;
  time: string;
  latitude: number;
  longitude: number;
  accuracy: string;
  reporter: string;
  viewerScope: string;
  signedLocationPath: string;
  locationHistory: Array<{ time: string; gps: string; accuracy: string }>;
  recordingConfigured: boolean;
  connectionStatus: string;
};

export type VerificationDashboardView = {
  pending: number;
  highConfidenceLast24h: number;
  lowConfidenceLast24h: number;
};

export type CommunityChannelView = {
  id: string;
  communityId: string;
  communityName: string;
  type: string;
  name: string;
};

export type ChannelMessageView = {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
};

export type ContentReportView = {
  id: string;
  communityId: string;
  communityName: string;
  targetType: string;
  targetId: string;
  reasonCode: string;
  note: string;
  status: string;
  createdAt: string;
};

export type JurisdictionRowView = {
  country: string;
  state: string;
  lga: string;
  ward: string;
  communities: number;
  users: number;
  policeStations: number;
};

export type DroneDashboardView = {
  fleetActive: number;
  activeMissions: number;
  scheduledMissions: number;
  liveVideoStreams: number;
  evidenceItems: number;
  activeOperators: number;
  geofences: number;
  noFlyZones: number;
};

export type DroneDeviceView = {
  id: string;
  deviceId: string;
  model: string;
  manufacturer: string;
  serialNumber: string;
  status: string;
  healthStatus: string;
  batteryLevel: number | null;
  signalStrength: number | null;
  firmwareVersion: string;
  flightHours: number;
  totalMissions: number;
  liveVideoCapable: boolean;
  lastGps: { lat: number; lng: number; at?: string | null } | null;
  lastSeenAt: string | null;
  isActive: boolean;
};

export type DroneMissionView = {
  id: string;
  missionCode: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  incidentId: string | null;
  incident: { id: string; title: string; status?: string } | null;
  droneId: string | null;
  drone: DroneDeviceView | null;
  operator: Record<string, unknown> | null;
  commander: Record<string, unknown> | null;
  target: { lat: number; lng: number; address?: string | null } | null;
  scheduledAt: string | null;
  launchedAt: string | null;
  completedAt: string | null;
  liveVideoStatus: string;
  liveVideoSessionId: string | null;
  correlationId: string | null;
  createdAt: string;
  updatedAt: string;
  latestTrack?: Record<string, unknown> | null;
};

export type DroneOperatorView = {
  id: string;
  name: string;
  email: string | null;
  callsign: string | null;
  operatorCode: string | null;
  operatorRole: string;
  certificationLevel: string | null;
  accountStatus: string;
  availabilityStatus: string;
  country: string | null;
  state: string | null;
  lga: string | null;
  assignedOperatingBase: string | null;
  licenceWarningLevel: string;
  activeAssignmentCount: number;
  isActive: boolean;
};

export type DroneOperatorDetailView = DroneOperatorView & {
  phone: string | null;
  assignedDroneId: string | null;
  assignedDroneDeviceId: string | null;
  currentAssignment: {
    missionId: string;
    missionCode: string | null;
    status: string | null;
  } | null;
  complianceSummary: {
    licenceExpiryAt: string | null;
    certificateExpiryAt: string | null;
    medicalExpiryAt: string | null;
  };
  missionStats: {
    totalMissions: number;
    completedMissions: number;
    abortedMissions: number;
    hoursFlown: number;
  };
  safetySummary: {
    incidentsInvolved: number;
    warningCount: number;
    lastIncidentAt: string | null;
  };
  documents: Array<{
    id: string;
    type: string;
    status: string;
    expiresAt: string | null;
  }>;
  auditEntries: Array<{
    id: string;
    action: string;
    actor: string;
    createdAt: string;
  }>;
};

export type DroneOperatorListStats = {
  total: number;
  available: number;
  onMission: number;
  pending: number;
  expiredLicences: number;
  certsExpiring: number;
  suspended: number;
};

export type DroneEvidenceView = {
  id: string;
  missionId: string;
  incidentId: string | null;
  mediaType: string;
  title: string;
  capturedAt: string;
  mission?: { missionCode: string; title: string };
  incident?: { id: string; title: string };
};

export type DroneGeofenceView = {
  id: string;
  name: string;
  fenceType: string;
  description: string | null;
  isActive: boolean;
  updatedAt: string;
};

export type DroneNoFlyZoneView = {
  id: string;
  name: string;
  reason: string | null;
  isActive: boolean;
  updatedAt: string;
};

export type DroneFlightLogView = {
  id: string;
  eventType: string;
  message: string;
  recordedAt: string;
  drone?: { deviceId: string; model: string };
  mission?: { missionCode: string; title: string };
};

export type DroneHealthView = DroneDeviceView & {
  latestHealth: Record<string, unknown> | null;
};

export type AdminSession = {
  sub: string;
  email?: string;
  role?: AdminRole;
  country?: string;
  state?: string;
  lga?: string;
  permissions?: string[];
};

export const roleScope: Record<AdminRole, string> = {
  [AdminRoleName.SuperAdmin]: "All countries, states, LGAs, agencies, and audit records",
  [AdminRoleName.CountryAdmin]: "Assigned country only",
  [AdminRoleName.StateAdmin]: "Assigned country and state only",
  [AdminRoleName.LgaAdmin]: "Assigned country, state, and LGA only",
  [AdminRoleName.AgencyAdmin]: "Incidents assigned to own agency",
  [AdminRoleName.PoliceSecurityOfficer]: "Incidents assigned to own agency",
  [AdminRoleName.CallCenterAgent]: "Assigned LGA intake and response coordination",
  [AdminRoleName.CommunityModerator]: "Assigned communities, membership approvals, post verification, patrols",
  [AdminRoleName.OversightAuditor]: "Read-only audit logs and incident history",
  [AdminRoleName.DroneCommander]: "Drone fleet command, mission launch, and geofence management",
  [AdminRoleName.DroneOperator]: "Assigned drone missions, live telemetry, and evidence capture",
  [AdminRoleName.ReadOnlyObserver]: "Read-only drone surveillance telemetry and evidence review",
};
