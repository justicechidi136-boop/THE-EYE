export enum FieldShiftStatus {
  PendingApproval = "PendingApproval",
  Active = "Active",
  Paused = "Paused",
  Ended = "Ended",
  Cancelled = "Cancelled",
}

export enum PatrolSessionStatus {
  Active = "Active",
  Paused = "Paused",
  Ended = "Ended",
}

export enum CheckpointSessionStatus {
  Active = "Active",
  Paused = "Paused",
  Ended = "Ended",
}

export enum OfficerOperationalStatus {
  OffDuty = "OffDuty",
  OnShift = "OnShift",
  OnPatrol = "OnPatrol",
  AtCheckpoint = "AtCheckpoint",
  Responding = "Responding",
  OnBreak = "OnBreak",
  Panic = "Panic",
}

export enum OperationalResponseType {
  Arrived = "Arrived",
  UnderControl = "UnderControl",
  Evacuating = "Evacuating",
  RoadClosed = "RoadClosed",
  MedicalRequired = "MedicalRequired",
  FireEscalating = "FireEscalating",
  NeedMoreUnits = "NeedMoreUnits",
  NeedDrone = "NeedDrone",
  Resolved = "Resolved",
  BackupRequested = "BackupRequested",
  SituationReport = "SituationReport",
}

export enum OperationalSightingType {
  MissingPerson = "MissingPerson",
  WantedSuspect = "WantedSuspect",
  WantedVehicle = "WantedVehicle",
  KidnappingAlert = "KidnappingAlert",
  AmberAlert = "AmberAlert",
  DroneObservation = "DroneObservation",
  BroadcastMatch = "BroadcastMatch",
  Other = "Other",
}

export enum OperationalSightingStatus {
  Open = "Open",
  Acknowledged = "Acknowledged",
  Closed = "Closed",
}

export const FIELD_WORKFLOW_ERROR_CODES = {
  SHIFT_REQUIRED: "FIELD-SHIFT-001",
  SHIFT_NOT_ACTIVE: "FIELD-SHIFT-002",
  PATROL_ALREADY_ACTIVE: "FIELD-PATROL-001",
  CHECKPOINT_ALREADY_ACTIVE: "FIELD-CHECKPOINT-001",
  SESSION_CONFLICT: "FIELD-SESSION-001",
  OFFLINE_QUEUE_DUPLICATE: "FIELD-SYNC-001",
} as const;

export type FieldWorkflowErrorCode = (typeof FIELD_WORKFLOW_ERROR_CODES)[keyof typeof FIELD_WORKFLOW_ERROR_CODES];

export const EMERGENCY_RESPONSE_TYPES = [
  OperationalResponseType.Arrived,
  OperationalResponseType.UnderControl,
  OperationalResponseType.Evacuating,
  OperationalResponseType.RoadClosed,
  OperationalResponseType.MedicalRequired,
  OperationalResponseType.FireEscalating,
  OperationalResponseType.NeedMoreUnits,
  OperationalResponseType.NeedDrone,
  OperationalResponseType.Resolved,
] as const;
