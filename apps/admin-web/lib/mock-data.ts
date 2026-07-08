export type AdminRole =
  | "Super Admin"
  | "Country Admin"
  | "State Admin"
  | "LGA Admin"
  | "Agency Admin"
  | "Police/Security Officer"
  | "Call Center Agent"
  | "Community Moderator"
  | "Oversight Auditor";

export type Incident = {
  id: string;
  type: string;
  title: string;
  description: string;
  priority: "P1" | "P2" | "P3" | "P4";
  status: string;
  confidenceScore: number;
  gps: { lat: number; lng: number; accuracy: string };
  reporterStatus: string;
  reportingMode: "Anonymous" | "Identified";
  assignedAgency: string;
  responseStatus: string;
  location: string;
  timeline: Array<{ time: string; event: string; actor: string }>;
  evidence: Array<{ type: string; name: string; hash: string }>;
};

export const currentRole: AdminRole = "State Admin";

export const roleScope: Record<AdminRole, string> = {
  "Super Admin": "All countries, states, LGAs, agencies, and audit records",
  "Country Admin": "Assigned country only",
  "State Admin": "Assigned country and state only",
  "LGA Admin": "Assigned country, state, and LGA only",
  "Agency Admin": "Incidents assigned to own agency",
  "Police/Security Officer": "Incidents assigned to own agency",
  "Call Center Agent": "Assigned LGA intake and response coordination",
  "Community Moderator": "Assigned communities, membership approvals, post verification, patrols",
  "Oversight Auditor": "Read-only audit logs and incident history",
};

export const rolePermissions = [
  { role: "Super Admin", scope: "Global", incidentAccess: "All incidents", canModifyIncidents: "Yes", auditAccess: "Full", communityAccess: "All communities" },
  { role: "Country Admin", scope: "Assigned country", incidentAccess: "Country only", canModifyIncidents: "Yes", auditAccess: "Scoped", communityAccess: "Country communities" },
  { role: "State Admin", scope: "Assigned state", incidentAccess: "State only", canModifyIncidents: "Yes", auditAccess: "Scoped", communityAccess: "State communities" },
  { role: "LGA Admin", scope: "Assigned LGA", incidentAccess: "LGA only", canModifyIncidents: "Yes", auditAccess: "Scoped", communityAccess: "LGA communities" },
  { role: "Agency Admin", scope: "Assigned agency", incidentAccess: "Assigned agency incidents", canModifyIncidents: "Assignment response only", auditAccess: "Agency actions", communityAccess: "Linked community alerts" },
  { role: "Police/Security Officer", scope: "Assigned agency", incidentAccess: "Dispatched incidents", canModifyIncidents: "Response updates", auditAccess: "Own actions", communityAccess: "Escalated community posts" },
  { role: "Call Center Agent", scope: "Assigned intake queue", incidentAccess: "Assigned LGA intake", canModifyIncidents: "Triage and assign", auditAccess: "Own actions", communityAccess: "Escalation queue" },
  { role: "Community Moderator", scope: "Assigned communities", incidentAccess: "Linked community incidents", canModifyIncidents: "Convert or escalate posts", auditAccess: "Community actions", communityAccess: "Manage assigned communities" },
  { role: "Oversight Auditor", scope: "Oversight", incidentAccess: "Read-only history", canModifyIncidents: "No", auditAccess: "Full read-only", communityAccess: "Read-only moderation audit" },
];

export const incidents: Incident[] = [
  {
    id: "INC-2407-001",
    type: "Emergency",
    title: "Armed robbery near Allen Avenue",
    description: "Citizen reported an active robbery with two suspects fleeing by motorcycle.",
    priority: "P1",
    status: "Assigned",
    confidenceScore: 91,
    gps: { lat: 6.6012, lng: 3.3514, accuracy: "12m" },
    reporterStatus: "Trusted reporter, KYC verified",
    reportingMode: "Identified",
    assignedAgency: "Ikeja Police Command",
    responseStatus: "Awaiting responder acknowledgement",
    location: "Allen Avenue, Ikeja, Lagos",
    timeline: [
      { time: "14:02", event: "Incident submitted", actor: "Citizen mobile app" },
      { time: "14:02", event: "System verification scored 91", actor: "Verification Engine" },
      { time: "14:03", event: "Assigned to Ikeja Police Command", actor: "Call Center Agent" },
      { time: "14:08", event: "Escalation timer active", actor: "Escalation Engine" },
    ],
    evidence: [
      { type: "Photo", name: "robbery-photo.jpg", hash: "sha256:seed-evidence-photo" },
      { type: "Audio", name: "witness-call.m4a", hash: "sha256:audio-evidence" },
    ],
  },
  {
    id: "INC-2407-002",
    type: "Missing person",
    title: "Missing teenager reported at Ikeja Bus Terminal",
    description: "Family reported a teenager missing after last contact near the terminal.",
    priority: "P2",
    status: "Verifying",
    confidenceScore: 74,
    gps: { lat: 6.603, lng: 3.35, accuracy: "35m" },
    reporterStatus: "KYC pending",
    reportingMode: "Identified",
    assignedAgency: "Lagos Emergency Response Unit",
    responseStatus: "Verification in progress",
    location: "Ikeja Bus Terminal, Lagos",
    timeline: [
      { time: "13:22", event: "Incident submitted", actor: "Citizen mobile app" },
      { time: "13:23", event: "Crowd confirmation requested", actor: "Verification Engine" },
      { time: "13:27", event: "One nearby confirmation received", actor: "Community witness" },
    ],
    evidence: [{ type: "Photo", name: "missing-person.jpg", hash: "sha256:missing-person-photo" }],
  },
  {
    id: "INC-2407-003",
    type: "Stolen vehicle",
    title: "Silver Toyota Corolla stolen",
    description: "Vehicle LAG-123-EYE reported stolen after active crime report.",
    priority: "P3",
    status: "Received",
    confidenceScore: 62,
    gps: { lat: 6.5988, lng: 3.3521, accuracy: "58m" },
    reporterStatus: "Trusted reporter",
    reportingMode: "Identified",
    assignedAgency: "Ikeja Police Command",
    responseStatus: "Awaiting verification",
    location: "Opebi Road, Ikeja",
    timeline: [
      { time: "12:40", event: "Vehicle report submitted", actor: "Citizen mobile app" },
      { time: "12:41", event: "Plate number matched to existing profile", actor: "System" },
    ],
    evidence: [],
  },
];

export const broadcasts = [
  {
    id: "BRC-1001",
    type: "Crime broadcast",
    title: "Safety alert for Allen Avenue",
    severity: "P2",
    status: "Pending approval",
    target: "3 km geofence around Allen Avenue",
    author: "Call Center Agent",
    requiresApproval: true,
    recipients: 428,
    delivery: "Queued",
  },
  {
    id: "BRC-1002",
    type: "Missing person broadcast",
    title: "Missing person public notice",
    severity: "P2",
    status: "Draft",
    target: "Lagos State, Ikeja priority",
    author: "State Admin",
    requiresApproval: true,
    recipients: 0,
    delivery: "Not dispatched",
  },
  {
    id: "BRC-1003",
    type: "Emergency broadcast",
    title: "Verified P1 emergency auto-alert",
    severity: "P1",
    status: "Published",
    target: "5 km geofence from verified GPS",
    author: "Verification Engine",
    requiresApproval: false,
    recipients: 1260,
    delivery: "Sent",
  },
];

export const agencies = [
  { name: "Ikeja Police Command", type: "Police", jurisdiction: "Ikeja LGA", activeIncidents: 8 },
  { name: "Lagos Emergency Response Unit", type: "Emergency", jurisdiction: "Lagos State", activeIncidents: 5 },
  { name: "State Fire Service", type: "Fire", jurisdiction: "Lagos State", activeIncidents: 2 },
];

export const users = [
  { name: "Amina Okafor", role: "Trusted Reporter", status: "KYC verified", scope: "Ikeja" },
  { name: "Ikeja Dispatcher", role: "Call Center Agent", status: "Active", scope: "Ikeja LGA" },
  { name: "THE EYE Super Admin", role: "Super Admin", status: "Active", scope: "Global" },
];

export const auditLogs = [
  { sequence: "000104", time: "14:08", actor: "Escalation Engine", action: "escalation.triggered", entity: "INC-2407-001", reason: "No acknowledgement within response window", previousHash: "72af...91cc", eventHash: "84bb...10ef", chain: "Verified" },
  { sequence: "000103", time: "14:03", actor: "Call Center Agent", action: "incident.assigned", entity: "INC-2407-001", reason: "Assigned to nearest police command", previousHash: "a91d...420e", eventHash: "72af...91cc", chain: "Verified" },
  { sequence: "000102", time: "13:58", actor: "State Admin", action: "evidence.downloaded", entity: "INC-2407-001", reason: "Evidence downloaded for investigation", previousHash: "f010...71ab", eventHash: "a91d...420e", chain: "Verified" },
  { sequence: "000101", time: "13:23", actor: "Verification Engine", action: "incident.status_changed", entity: "INC-2407-002", reason: "Crowd confirmation requested", previousHash: "6abd...58c2", eventHash: "f010...71ab", chain: "Verified" },
];

export const notificationOperations = [
  { id: "NOT-001", type: "EmergencyAlert", title: "Verified P1 emergency nearby", channel: "push", provider: "firebase-cloud-messaging", priority: "Critical", target: "5 km geofence", status: "Delivered", read: "Unread", logs: 2 },
  { id: "NOT-002", type: "FamilySosAlert", title: "Amina triggered smartwatch SOS", channel: "sms", provider: "sms-placeholder", priority: "Critical", target: "Emergency contacts", status: "Sent", read: "Unread", logs: 1 },
  { id: "NOT-003", type: "BroadcastAlert", title: "Safety alert for Allen Avenue", channel: "in_app", provider: "in-app", priority: "High", target: "428 nearby users", status: "Delivered", read: "Read", logs: 3 },
  { id: "NOT-004", type: "AdminAssignmentAlert", title: "Incident assigned to Ikeja command", channel: "email", provider: "email-placeholder", priority: "High", target: "Agency admins", status: "Sent", read: "Unread", logs: 1 },
];

export const communities = [
  { id: "COM-001", name: "Allen Avenue Estate", level: "Estate", visibility: "Private", hierarchy: "Nigeria / Lagos / Ikeja / Ward C / Allen / Estate", members: 384, pending: 12, posts: 46, confidence: 82 },
  { id: "COM-002", name: "Opebi Street Watch", level: "Street", visibility: "Public", hierarchy: "Nigeria / Lagos / Ikeja / Ward C / Opebi / Street", members: 218, pending: 0, posts: 31, confidence: 74 },
  { id: "COM-003", name: "Ikeja Business Owners", level: "Community", visibility: "Private", hierarchy: "Nigeria / Lagos / Ikeja / Ward A", members: 156, pending: 7, posts: 18, confidence: 69 },
];

export const communityPosts = [
  { id: "CPOST-001", community: "Allen Avenue Estate", type: "Suspicious activity", title: "Two unknown riders circling Gate 2", status: "Pending Verification", confidence: 64, linkedIncident: "INC-2407-001", author: "Trusted reporter", location: "6.6012, 3.3514" },
  { id: "CPOST-002", community: "Opebi Street Watch", type: "Security meeting", title: "Night patrol briefing", status: "Verified", confidence: 91, linkedIncident: "-", author: "Community Moderator", location: "6.5988, 3.3521" },
  { id: "CPOST-003", community: "Ikeja Business Owners", type: "Missing person", title: "Lost child near terminal", status: "Disputed", confidence: 48, linkedIncident: "INC-2407-002", author: "Resident", location: "6.6030, 3.3500" },
];

export const volunteers = [
  { name: "Dr. Ada Nwosu", type: "Doctor", community: "Allen Avenue Estate", status: "Verified", distance: "0.8 km" },
  { name: "Kunle Peters", type: "Security Volunteer", community: "Opebi Street Watch", status: "Available", distance: "1.4 km" },
  { name: "Mariam Bello", type: "Search and Rescue", community: "Ikeja Business Owners", status: "Available", distance: "2.2 km" },
];

export const patrolSchedules = [
  { id: "PAT-001", title: "Gate 2 evening patrol", community: "Allen Avenue Estate", status: "Scheduled", volunteers: 4, checkpoints: 6 },
  { id: "PAT-002", title: "Opebi business corridor patrol", community: "Opebi Street Watch", status: "Active", volunteers: 6, checkpoints: 11 },
];

export const policeStations = [
  { id: "POL-001", name: "Ikeja Central Police Station", phone: "+2348000003001", address: "Ikeja, Lagos", state: "Lagos", lga: "Ikeja", latitude: 6.6018, longitude: 3.3515, agencyType: "police", distance: "0.2 km" },
  { id: "POL-002", name: "Alausa Security Post", phone: "+2348000003002", address: "Alausa Secretariat Road, Ikeja", state: "Lagos", lga: "Ikeja", latitude: 6.6172, longitude: 3.3589, agencyType: "security", distance: "2.4 km" },
  { id: "POL-003", name: "Opebi Police Desk", phone: "+2348000003003", address: "Opebi Road, Ikeja", state: "Lagos", lga: "Ikeja", latitude: 6.5988, longitude: 3.3521, agencyType: "police", distance: "1.1 km" },
];

export const liveVideoSessions = [
  {
    id: "LVS-001",
    incidentId: "INC-2026-000123",
    roomName: "eye-incident-inc-2407-001",
    status: "Active",
    lowBandwidth: true,
    startedAt: "09:34",
    viewerScope: "State Admin / Ikeja",
    evidence: "Recording pending",
    date: "06 July 2026",
    time: "09:34:22 WAT",
    latitude: 6.5244,
    longitude: 3.3792,
    accuracy: "±8m",
    reporter: "Anonymous-8392",
    signedLocationPath: "/live-video/sessions/LVS-001/location/open/signed-admin-token",
    locationHistory: [
      { time: "09:34:22 WAT", gps: "6.5244, 3.3792", accuracy: "±8m" },
      { time: "09:34:27 WAT", gps: "6.5248, 3.3796", accuracy: "±9m" },
      { time: "09:34:32 WAT", gps: "6.5251, 3.3801", accuracy: "±7m" },
    ],
  },
  {
    id: "LVS-002",
    incidentId: "INC-2407-002",
    roomName: "eye-incident-inc-2407-002",
    status: "Ended",
    lowBandwidth: false,
    startedAt: "13:31",
    viewerScope: "State Admin / Ikeja",
    evidence: "Linked to evidence",
    date: "06 July 2026",
    time: "13:31:08 WAT",
    latitude: 6.603,
    longitude: 3.35,
    accuracy: "±14m",
    reporter: "55555555-5555-5555-5555-555555555555",
    signedLocationPath: "/live-video/sessions/LVS-002/location/open/signed-admin-token",
    locationHistory: [
      { time: "13:31:08 WAT", gps: "6.6030, 3.3500", accuracy: "±14m" },
      { time: "13:31:13 WAT", gps: "6.6032, 3.3501", accuracy: "±12m" },
    ],
  },
];

export const smartwatchDevices = [
  {
    id: "SWD-001",
    deviceId: "EYE-WATCH-SEED-001",
    owner: "Amina Okafor",
    provider: "THE EYE SOS Watch",
    model: "EYE-SOS-1",
    mode: "Standalone cellular",
    preferredMode: "Standalone cellular",
    pairingMethod: "QR Code",
    status: "Online",
    battery: 87,
    signal: 76,
    firmware: "1.0.1",
    security: "Certificate valid",
    alerts: "Enabled",
    lastSeen: "09:35 WAT",
    lastGps: { lat: 6.6012, lng: 3.3514, accuracy: "9m" },
  },
  {
    id: "SWD-002",
    deviceId: "EYE-WATCH-PAIR-044",
    owner: "Kunle Peters",
    provider: "Wear OS",
    model: "Pixel Watch",
    mode: "Paired phone",
    preferredMode: "Paired phone",
    pairingMethod: "Bluetooth",
    status: "Online",
    battery: 64,
    signal: 88,
    firmware: "1.0.0",
    security: "Certificate valid",
    alerts: "Enabled",
    lastSeen: "09:31 WAT",
    lastGps: { lat: 6.5988, lng: 3.3521, accuracy: "14m" },
  },
  {
    id: "SWD-003",
    deviceId: "EYE-WATCH-LOW-108",
    owner: "Mariam Bello",
    provider: "Samsung Health",
    model: "Galaxy Watch",
    mode: "Paired phone",
    preferredMode: "Paired phone",
    pairingMethod: "Pairing Code",
    status: "Needs attention",
    battery: 12,
    signal: 18,
    firmware: "0.9.8",
    security: "Firmware signature unknown",
    alerts: "Enabled",
    lastSeen: "08:58 WAT",
    lastGps: { lat: 6.603, lng: 3.35, accuracy: "22m" },
  },
];

export const firmwareReleases = [
  { version: "1.0.1", title: "Emergency failover baseline", status: "Published", signature: "Valid", devices: 42, rollback: "Available" },
  { version: "1.0.0", title: "Initial LTE and BLE support", status: "Published", signature: "Valid", devices: 118, rollback: "Available" },
  { version: "1.1.0-beta", title: "Voice trigger preview", status: "Draft", signature: "Pending", devices: 0, rollback: "-" },
];

export const sosEvents = [
  {
    id: "SOS-001",
    incidentId: "INC-2407-001",
    user: "Amina Okafor",
    deviceId: "EYE-WATCH-SEED-001",
    status: "Active",
    sourceMode: "Standalone cellular",
    priority: "P1",
    triggeredAt: "09:34:22 WAT",
    familyAlerted: "Yes",
    response: "Ikeja Police Command assigned",
    gps: { lat: 6.6012, lng: 3.3514, accuracy: "9m" },
  },
  {
    id: "SOS-002",
    incidentId: "INC-2407-002",
    user: "Kunle Peters",
    deviceId: "EYE-WATCH-PAIR-044",
    status: "Resolved",
    sourceMode: "Paired phone",
    priority: "P1",
    triggeredAt: "08:42:10 WAT",
    familyAlerted: "Yes",
    response: "Call center confirmed false alarm",
    gps: { lat: 6.5988, lng: 3.3521, accuracy: "14m" },
  },
];
