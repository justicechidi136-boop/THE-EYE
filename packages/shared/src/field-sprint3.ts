export enum FieldBackupRequestType {
  Immediate = "Immediate",
  Medical = "Medical",
  Fire = "Fire",
  Armed = "Armed",
  Traffic = "Traffic",
  Supervisor = "Supervisor",
  Tow = "Tow",
  Drone = "Drone",
}

export enum FieldBackupRequestStatus {
  Requested = "Requested",
  Acknowledged = "Acknowledged",
  Assigned = "Assigned",
  EnRoute = "EnRoute",
  Arrived = "Arrived",
  Cancelled = "Cancelled",
  Resolved = "Resolved",
}

export enum FieldOfficerSafetyAlertType {
  Panic = "Panic",
  OfficerDown = "OfficerDown",
  MissedCheckIn = "MissedCheckIn",
  DistressSignal = "DistressSignal",
}

export enum FieldOfficerSafetyAlertStatus {
  Active = "Active",
  Acknowledged = "Acknowledged",
  Resolved = "Resolved",
  Cancelled = "Cancelled",
}

export enum FieldOperationalEventType {
  AssignmentCreated = "AssignmentCreated",
  AssignmentCancelled = "AssignmentCancelled",
  AssignmentReassigned = "AssignmentReassigned",
  DispatcherMessage = "DispatcherMessage",
  BackupRequested = "BackupRequested",
  BackupAssigned = "BackupAssigned",
  PatrolStatus = "PatrolStatus",
  CheckpointAlert = "CheckpointAlert",
  BoloMatch = "BoloMatch",
  DroneMission = "DroneMission",
  IncidentStatus = "IncidentStatus",
  ResponderStatus = "ResponderStatus",
  OfficerSafety = "OfficerSafety",
  DeviceHealth = "DeviceHealth",
  ShiftAlert = "ShiftAlert",
}

export enum FieldPatrolEventType {
  ZoneEntry = "ZoneEntry",
  ZoneExit = "ZoneExit",
  Stop = "Stop",
  Deviation = "Deviation",
  CheckpointMissed = "CheckpointMissed",
  GpsUnavailable = "GpsUnavailable",
  WeakAccuracy = "WeakAccuracy",
  Break = "Break",
  ConnectivityLoss = "ConnectivityLoss",
}

export enum FieldCheckpointObservationType {
  Vehicle = "Vehicle",
  Person = "Person",
  Plate = "Plate",
  Vin = "Vin",
  BroadcastMatch = "BroadcastMatch",
}

export type FieldMapLayerId =
  | "currentUnit"
  | "patrolZone"
  | "checkpointPerimeter"
  | "assignedIncidents"
  | "nearbyIncidents"
  | "fieldUnits"
  | "policeStations"
  | "fireStations"
  | "hospitals"
  | "roadClosures"
  | "dangerZones"
  | "missingPersonBroadcasts"
  | "stolenVehicleBroadcasts"
  | "droneMissions"
  | "backupRequests"
  | "responderRoutes"
  | "incidentGeofences";

export const FIELD_SYNC_ERROR_CODES = {
  DUPLICATE_CLIENT_ACTION: "FIELD-SYNC-001",
  STALE_GENERATION: "FIELD-SYNC-002",
  ASSIGNMENT_INACTIVE: "FIELD-SYNC-003",
  INCIDENT_RESOLVED: "FIELD-SYNC-004",
  DEVICE_REVOKED: "FIELD-SYNC-005",
  SHIFT_CLOSED: "FIELD-SYNC-006",
  BATCH_TOO_LARGE: "FIELD-SYNC-007",
  CONFLICT_NEWER_SERVER_STATE: "FIELD-SYNC-008",
  SUPERVISOR_REVIEW_REQUIRED: "FIELD-SYNC-009",
} as const;

export type FieldSyncErrorCode = (typeof FIELD_SYNC_ERROR_CODES)[keyof typeof FIELD_SYNC_ERROR_CODES];

export const FIELD_OPERATIONAL_NOTIFICATION_TYPES = [
  "FIELD_ASSIGNMENT",
  "FIELD_ASSIGNMENT_REASSIGNED",
  "FIELD_MESSAGE",
  "FIELD_BACKUP_REQUEST",
  "FIELD_BACKUP_ASSIGNED",
  "FIELD_OFFICER_SAFETY_ALERT",
  "FIELD_CHECKPOINT_ALERT",
  "FIELD_BOLO_ALERT",
  "FIELD_DRONE_MISSION",
  "FIELD_DEVICE_HEALTH_WARNING",
  "FIELD_SHIFT_ALERT",
] as const;

export type FieldOperationalNotificationType = (typeof FIELD_OPERATIONAL_NOTIFICATION_TYPES)[number];

export const FIELD_SYNC_MAX_BATCH_SIZE = 50;
