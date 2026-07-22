export enum UserRole {
  Citizen = "citizen",
  TrustedReporter = "trusted_reporter",
  Responder = "responder",
}

export enum AdminRoleName {
  SuperAdmin = "Super Admin",
  CountryAdmin = "Country Admin",
  StateAdmin = "State Admin",
  LgaAdmin = "LGA Admin",
  AgencyAdmin = "Agency Admin",
  PoliceSecurityOfficer = "Police/Security Officer",
  CallCenterAgent = "Call Center Agent",
  CommunityModerator = "Community Moderator",
  OversightAuditor = "Oversight Auditor",
}

export enum IncidentType {
  Emergency = "Emergency",
  Crime = "Crime",
  Accident = "Accident",
  Fire = "Fire",
  Medical = "Medical",
  CommunitySafety = "CommunitySafety",
  Kidnapping = "Kidnapping",
  Abuse = "Abuse",
  SuspiciousActivity = "SuspiciousActivity",
  MissingPerson = "MissingPerson",
  StolenVehicle = "StolenVehicle",
  SOS = "SOS",
}

export enum IncidentStatus {
  Submitted = "Submitted",
  Received = "Received",
  Verifying = "Verifying",
  Verified = "Verified",
  Assigned = "Assigned",
  Responding = "Responding",
  Resolved = "Resolved",
  Closed = "Closed",
  FalseReport = "FalseReport",
}

export enum IncidentPriority {
  P1LifeThreatening = "P1LifeThreatening",
  P2ActiveCrimeAccident = "P2ActiveCrimeAccident",
  P3SuspiciousActivity = "P3SuspiciousActivity",
  P4GeneralSafety = "P4GeneralSafety",
}

export enum BroadcastType {
  Emergency = "Emergency",
  Crime = "Crime",
  Accident = "Accident",
  MissingPerson = "MissingPerson",
  StolenVehicle = "StolenVehicle",
  GovernmentAlert = "GovernmentAlert",
  CommunityWarning = "CommunityWarning",
}

export enum BroadcastStatus {
  Draft = "Draft",
  PendingApproval = "PendingApproval",
  Scheduled = "Scheduled",
  DispatchQueued = "DispatchQueued",
  Dispatching = "Dispatching",
  Published = "Published",
  Failed = "Failed",
  Expired = "Expired",
  Cancelled = "Cancelled",
  Rejected = "Rejected",
}

export enum CommunityRoleName {
  CommunityModerator = "Community Moderator",
  EstateAdmin = "Estate Admin",
  SecurityCoordinator = "Security Coordinator",
  PoliceLiaison = "Police Liaison",
  VolunteerCoordinator = "Volunteer Coordinator",
  VerifiedVolunteer = "Verified Volunteer",
  Resident = "Resident",
}

export enum SmartwatchConnectivityMode {
  PairedPhone = "PairedPhone",
  StandaloneCellular = "StandaloneCellular",
}

export enum SmartwatchPairingMethod {
  QrCode = "QrCode",
  Bluetooth = "Bluetooth",
  PairingCode = "PairingCode",
  Nfc = "Nfc",
}

export enum SmartwatchEmergencyMode {
  SilentSOS = "SilentSOS",
  NormalSOS = "NormalSOS",
  MedicalSOS = "MedicalSOS",
  KidnappingSOS = "KidnappingSOS",
  FireSOS = "FireSOS",
  ChildSOS = "ChildSOS",
  WomenSafetySOS = "WomenSafetySOS",
}

export enum SmartwatchOfflineEventType {
  GPS = "GPS",
  SOS = "SOS",
  Media = "Media",
  Heartbeat = "Heartbeat",
  IncidentAcknowledgement = "IncidentAcknowledgement",
}

export enum FirmwareSignatureStatus {
  Unknown = "Unknown",
  Valid = "Valid",
  Invalid = "Invalid",
  Revoked = "Revoked",
}

export enum IncidentMediaType {
  Image = "Image",
  Video = "Video",
  Audio = "Audio",
  Document = "Document",
  LiveVideoRecording = "LiveVideoRecording",
}

export enum ResponderAvailability {
  Offline = "Offline",
  Available = "Available",
  Busy = "Busy",
  EnRoute = "EnRoute",
  OnScene = "OnScene",
  OutOfService = "OutOfService",
}

export enum ResponseUnitStatus {
  Offline = "Offline",
  Available = "Available",
  Busy = "Busy",
  EnRoute = "EnRoute",
  OnScene = "OnScene",
  OutOfService = "OutOfService",
}

export enum IncidentAssignmentStatus {
  Proposed = "Proposed",
  Assigned = "Assigned",
  Accepted = "Accepted",
  Declined = "Declined",
  Expired = "Expired",
  Reassigned = "Reassigned",
  Arrived = "Arrived",
  Completed = "Completed",
  Cancelled = "Cancelled",
}
