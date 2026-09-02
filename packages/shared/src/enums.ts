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
  DroneCommander = "Drone Commander",
  DroneOperator = "Drone Operator",
  ReadOnlyObserver = "Read-only Observer",
}

export enum DroneDeviceStatus {
  Active = "Active",
  Maintenance = "Maintenance",
  Offline = "Offline",
  Retired = "Retired",
}

export enum DroneHealthStatus {
  Healthy = "Healthy",
  Degraded = "Degraded",
  Critical = "Critical",
}

export enum DroneMissionStatus {
  Scheduled = "Scheduled",
  Preflight = "Preflight",
  Active = "Active",
  Paused = "Paused",
  Completed = "Completed",
  Aborted = "Aborted",
  Failed = "Failed",
}

export enum DroneLiveVideoStatus {
  Offline = "Offline",
  Starting = "Starting",
  Live = "Live",
  Ended = "Ended",
}

export enum DroneOperatorRole {
  Commander = "Commander",
  Operator = "Operator",
  Observer = "Observer",
}

export enum DroneGeofenceType {
  Operational = "Operational",
  Restricted = "Restricted",
  IncidentPerimeter = "IncidentPerimeter",
}

export enum DroneEmploymentType {
  AgencyStaff = "AgencyStaff",
  Contractor = "Contractor",
  Volunteer = "Volunteer",
  Trainee = "Trainee",
}

export enum DroneOperatorAccountStatus {
  PendingReview = "PendingReview",
  Active = "Active",
  Assigned = "Assigned",
  OnMission = "OnMission",
  OffDuty = "OffDuty",
  OnLeave = "OnLeave",
  Training = "Training",
  Suspended = "Suspended",
  Inactive = "Inactive",
  Rejected = "Rejected",
}

export enum DroneOperatorAvailability {
  Available = "Available",
  Assigned = "Assigned",
  OnMission = "OnMission",
  OffDuty = "OffDuty",
  OnLeave = "OnLeave",
  Training = "Training",
  Suspended = "Suspended",
  Unavailable = "Unavailable",
}

export enum DroneVerificationStatus {
  Unverified = "Unverified",
  PendingReview = "PendingReview",
  Verified = "Verified",
  Expired = "Expired",
  Suspended = "Suspended",
  Rejected = "Rejected",
}

export enum DroneCertificationType {
  EmergencyResponse = "EmergencyResponse",
  NightOperations = "NightOperations",
  ThermalImaging = "ThermalImaging",
  SearchAndRescue = "SearchAndRescue",
  FireAssessment = "FireAssessment",
  FloodAssessment = "FloodAssessment",
  CrowdMonitoring = "CrowdMonitoring",
  BeyondVisualLineOfSight = "BeyondVisualLineOfSight",
  PayloadOperation = "PayloadOperation",
  EvidenceCapture = "EvidenceCapture",
  Maintenance = "Maintenance",
  Other = "Other",
}

export enum DroneQualificationLevel {
  Trainee = "Trainee",
  Qualified = "Qualified",
  Senior = "Senior",
  Instructor = "Instructor",
}

export enum DroneQualificationStatus {
  Active = "Active",
  Expired = "Expired",
  Revoked = "Revoked",
  Pending = "Pending",
}

export enum DroneOperatorDocumentType {
  PilotLicence = "PilotLicence",
  TrainingCertificate = "TrainingCertificate",
  GovernmentId = "GovernmentId",
  SecurityClearance = "SecurityClearance",
  Insurance = "Insurance",
  MedicalClearance = "MedicalClearance",
  EmploymentAgreement = "EmploymentAgreement",
  DisciplinaryRecord = "DisciplinaryRecord",
  CompetencyAssessment = "CompetencyAssessment",
  Other = "Other",
}

export enum DroneMissionAssignmentRole {
  Primary = "Primary",
  Secondary = "Secondary",
  Payload = "Payload",
}

export enum DroneMissionAssignmentStatus {
  Pending = "Pending",
  Accepted = "Accepted",
  Declined = "Declined",
  Active = "Active",
  Completed = "Completed",
  Removed = "Removed",
}

export enum DroneSafetyRecordType {
  SafetyIncident = "SafetyIncident",
  FlightViolation = "FlightViolation",
  HardLanding = "HardLanding",
  SignalLoss = "SignalLoss",
  GeofenceViolation = "GeofenceViolation",
  NoFlyZoneAttempt = "NoFlyZoneAttempt",
  EquipmentDamage = "EquipmentDamage",
  MissionAbort = "MissionAbort",
  Complaint = "Complaint",
  CorrectiveAction = "CorrectiveAction",
  Suspension = "Suspension",
  Commendation = "Commendation",
  RetrainingRequired = "RetrainingRequired",
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
  UnderControl = "UnderControl",
  CancellationRequested = "CancellationRequested",
  Ended = "Ended",
  Resolved = "Resolved",
  Closed = "Closed",
  FalseReport = "FalseReport",
  CancelledByReporter = "CancelledByReporter",
  ExpiredAfterReview = "ExpiredAfterReview",
}

/** Who or what recorded the terminal resolution — not a duplicate lifecycle status. */
export enum ResolutionSource {
  Agency = "Agency",
  Dispatcher = "Dispatcher",
  Administrator = "Administrator",
  Reporter = "Reporter",
  Community = "Community",
  SystemReview = "SystemReview",
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
  SafetyAlert = "SafetyAlert",
  GovernmentAlert = "GovernmentAlert",
  CommunityWarning = "CommunityWarning",
  PublicAdvisory = "PublicAdvisory",
  EmergencyWarning = "EmergencyWarning",
}

export enum BroadcastStatus {
  Draft = "Draft",
  PendingApproval = "PendingApproval",
  Scheduled = "Scheduled",
  DispatchQueued = "DispatchQueued",
  Dispatching = "Dispatching",
  Published = "Published",
  Active = "Active",
  Updated = "Updated",
  Resolved = "Resolved",
  Suspended = "Suspended",
  DeletedByAdmin = "DeletedByAdmin",
  WithdrawnByAuthor = "WithdrawnByAuthor",
  Failed = "Failed",
  Expired = "Expired",
  Cancelled = "Cancelled",
  Rejected = "Rejected",
}

export enum BroadcastAuthorType {
  Citizen = "Citizen",
  Admin = "Admin",
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

export enum DangerZoneStatus {
  PendingVerification = "PendingVerification",
  ActiveCritical = "ActiveCritical",
  ActiveHigh = "ActiveHigh",
  ActiveModerate = "ActiveModerate",
  Contained = "Contained",
  Monitoring = "Monitoring",
  AllClear = "AllClear",
  Expired = "Expired",
  CancelledFalseReport = "CancelledFalseReport",
}

export enum SafetyAlertLevel {
  P1Immediate = "P1Immediate",
  P2Serious = "P2Serious",
  P3Awareness = "P3Awareness",
  P4AllClear = "P4AllClear",
}

export enum SafetyAlertState {
  Awareness = "Awareness",
  Approaching = "Approaching",
  Critical = "Critical",
  InsideDangerZone = "InsideDangerZone",
  MovingAway = "MovingAway",
  Clear = "Clear",
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
  EnRoute = "EnRoute",
  Arrived = "Arrived",
  InProgress = "InProgress",
  Completed = "Completed",
  Cancelled = "Cancelled",
}

export enum EmergencyCategory {
  SecurityCrime = "SecurityCrime",
  Medical = "Medical",
  Fire = "Fire",
  RoadTraffic = "RoadTraffic",
  DomesticViolence = "DomesticViolence",
  Kidnapping = "Kidnapping",
  MissingPerson = "MissingPerson",
  NaturalDisaster = "NaturalDisaster",
  SilentSos = "SilentSos",
  Other = "Other",
}
