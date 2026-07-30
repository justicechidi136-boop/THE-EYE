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
    moderationStatus?: string | null;
    uploadedAt?: string | null;
  }>;
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
  requiresApproval: boolean;
  recipients: number;
  delivery: string;
  scheduledAt: string | null;
  schedulingState: string;
  dispatchFailureReason: string | null;
  autoDispatchStatus: string;
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
  body?: string;
  status: string;
  confidence: number;
  linkedIncident: string;
  author: string;
  location: string;
  media: Array<{
    id: string;
    type: string;
    name: string;
    contentType?: string;
    durationSeconds?: number | null;
    transcriptionStatus?: string | null;
    transcript?: string | null;
    uploadedAt?: string | null;
  }>;
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
  status: string;
  volunteers: number;
  checkpoints: number;
  latitude?: number;
  longitude?: number;
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
};
