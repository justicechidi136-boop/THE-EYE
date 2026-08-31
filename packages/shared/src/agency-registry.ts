import { FieldOperationalRole } from "./field-operations";

/** Controlled agency classification — does not grant permissions by itself. */
export enum AgencyType {
  Police = "POLICE",
  FireRescue = "FIRE_RESCUE",
  Ems = "EMS",
  RoadSafety = "ROAD_SAFETY",
  CivilDefence = "CIVIL_DEFENCE",
  EmergencyManagement = "EMERGENCY_MANAGEMENT",
  Military = "MILITARY",
  Intelligence = "INTELLIGENCE",
  Immigration = "IMMIGRATION",
  Corrections = "CORRECTIONS",
  MaritimeSecurity = "MARITIME_SECURITY",
  Customs = "CUSTOMS",
  DrugEnforcement = "DRUG_ENFORCEMENT",
  AntiTrafficking = "ANTI_TRAFFICKING",
  AntiCorruption = "ANTI_CORRUPTION",
  Cybercrime = "CYBERCRIME",
  ChildProtection = "CHILD_PROTECTION",
  GbvResponse = "GBV_RESPONSE",
  EnvironmentalResponse = "ENVIRONMENTAL_RESPONSE",
  PublicHealthEmergency = "PUBLIC_HEALTH_EMERGENCY",
  StateEmergencyAgency = "STATE_EMERGENCY_AGENCY",
  TrafficManagement = "TRAFFIC_MANAGEMENT",
  PrivateSecurity = "PRIVATE_SECURITY",
  LocalGovernment = "LOCAL_GOVERNMENT",
  Other = "OTHER",
}

export enum AgencyJurisdictionLevel {
  Country = "COUNTRY",
  State = "STATE",
  Lga = "LGA",
  Unit = "UNIT",
}

export enum AgencyStatus {
  Active = "Active",
  Inactive = "Inactive",
}

export enum AgencyCapability {
  IncidentDispatch = "INCIDENT_DISPATCH",
  Patrol = "PATROL",
  Checkpoint = "CHECKPOINT",
  FireResponse = "FIRE_RESPONSE",
  MedicalResponse = "MEDICAL_RESPONSE",
  RoadResponse = "ROAD_RESPONSE",
  DroneOperation = "DRONE_OPERATION",
  MarineResponse = "MARINE_RESPONSE",
  SearchRescue = "SEARCH_RESCUE",
  BroadcastAuthority = "BROADCAST_AUTHORITY",
  Bolo = "BOLO",
  FieldOperations = "FIELD_OPERATIONS",
  CommunityVerificationReview = "COMMUNITY_VERIFICATION_REVIEW",
}

export enum AgencyUnitKind {
  Command = "Command",
  Area = "Area",
  Station = "Station",
  Patrol = "Patrol",
  Other = "Other",
}

export const AGENCY_ERROR_CODES = {
  NOT_FOUND: "AGENCY-001",
  INACTIVE: "AGENCY-002",
  OUTSIDE_JURISDICTION: "AGENCY-003",
  ROLE_NOT_PERMITTED: "AGENCY-004",
  UNIT_NOT_IN_AGENCY: "AGENCY-005",
  FIELD_OPS_DISABLED: "AGENCY-006",
  INVALID_TYPE: "AGENCY-007",
  INVALID_CAPABILITY: "AGENCY-008",
  CODE_CONFLICT: "AGENCY-009",
} as const;

export type AgencyErrorCode = (typeof AGENCY_ERROR_CODES)[keyof typeof AGENCY_ERROR_CODES];

export const AGENCY_TYPES = Object.values(AgencyType);
export const AGENCY_CAPABILITIES = Object.values(AgencyCapability);
export const AGENCY_JURISDICTION_LEVELS = Object.values(AgencyJurisdictionLevel);
export const AGENCY_UNIT_KINDS = Object.values(AgencyUnitKind);

/** Map legacy free-text Agency.type values to controlled AgencyType. */
export const LEGACY_AGENCY_TYPE_MAP: Record<string, AgencyType> = {
  police: AgencyType.Police,
  POLICE: AgencyType.Police,
  emergency: AgencyType.Ems,
  EMS: AgencyType.Ems,
  fire: AgencyType.FireRescue,
  FIRE: AgencyType.FireRescue,
  FIRE_RESCUE: AgencyType.FireRescue,
  frsc: AgencyType.RoadSafety,
  ROAD_SAFETY: AgencyType.RoadSafety,
  nscdc: AgencyType.CivilDefence,
  CIVIL_DEFENCE: AgencyType.CivilDefence,
  security: AgencyType.PrivateSecurity,
  OTHER: AgencyType.Other,
};

export function normalizeAgencyType(value: string | null | undefined): AgencyType | null {
  if (!value) return null;
  const trimmed = value.trim();
  if ((AGENCY_TYPES as string[]).includes(trimmed)) return trimmed as AgencyType;
  return LEGACY_AGENCY_TYPE_MAP[trimmed] ?? LEGACY_AGENCY_TYPE_MAP[trimmed.toLowerCase()] ?? null;
}

export function isAgencyCapability(value: unknown): value is AgencyCapability {
  return typeof value === "string" && (AGENCY_CAPABILITIES as string[]).includes(value);
}

export function validateAgencyCapabilities(values: readonly string[]): {
  valid: boolean;
  unknown: string[];
  known: AgencyCapability[];
} {
  const unknown: string[] = [];
  const known: AgencyCapability[] = [];
  for (const value of values) {
    if (isAgencyCapability(value)) known.push(value);
    else unknown.push(value);
  }
  return { valid: unknown.length === 0, unknown, known };
}

/** Default FO operational roles allowed per agency type. */
export const AGENCY_TYPE_FIELD_ROLES: Record<AgencyType, FieldOperationalRole[]> = {
  [AgencyType.Police]: [
    FieldOperationalRole.PatrolOfficer,
    FieldOperationalRole.PatrolTeamLead,
    FieldOperationalRole.CheckpointOfficer,
    FieldOperationalRole.CheckpointCommander,
    FieldOperationalRole.Dispatcher,
    FieldOperationalRole.AgencySupervisor,
    FieldOperationalRole.DroneOperator,
  ],
  [AgencyType.FireRescue]: [
    FieldOperationalRole.Dispatcher,
    FieldOperationalRole.AgencySupervisor,
  ],
  [AgencyType.Ems]: [
    FieldOperationalRole.Dispatcher,
    FieldOperationalRole.AgencySupervisor,
  ],
  [AgencyType.RoadSafety]: [
    FieldOperationalRole.PatrolOfficer,
    FieldOperationalRole.PatrolTeamLead,
    FieldOperationalRole.CheckpointOfficer,
    FieldOperationalRole.Dispatcher,
    FieldOperationalRole.AgencySupervisor,
  ],
  [AgencyType.CivilDefence]: [
    FieldOperationalRole.PatrolOfficer,
    FieldOperationalRole.CheckpointOfficer,
    FieldOperationalRole.Dispatcher,
    FieldOperationalRole.AgencySupervisor,
  ],
  [AgencyType.EmergencyManagement]: [
    FieldOperationalRole.Dispatcher,
    FieldOperationalRole.AgencySupervisor,
  ],
  [AgencyType.Military]: [FieldOperationalRole.AgencySupervisor],
  [AgencyType.Intelligence]: [FieldOperationalRole.AgencySupervisor],
  [AgencyType.Immigration]: [
    FieldOperationalRole.CheckpointOfficer,
    FieldOperationalRole.Dispatcher,
    FieldOperationalRole.AgencySupervisor,
  ],
  [AgencyType.Corrections]: [FieldOperationalRole.AgencySupervisor],
  [AgencyType.MaritimeSecurity]: [
    FieldOperationalRole.PatrolOfficer,
    FieldOperationalRole.Dispatcher,
    FieldOperationalRole.AgencySupervisor,
  ],
  [AgencyType.Customs]: [
    FieldOperationalRole.CheckpointOfficer,
    FieldOperationalRole.AgencySupervisor,
  ],
  [AgencyType.DrugEnforcement]: [
    FieldOperationalRole.CheckpointOfficer,
    FieldOperationalRole.Dispatcher,
    FieldOperationalRole.AgencySupervisor,
  ],
  [AgencyType.AntiTrafficking]: [
    FieldOperationalRole.Dispatcher,
    FieldOperationalRole.AgencySupervisor,
  ],
  [AgencyType.AntiCorruption]: [FieldOperationalRole.AgencySupervisor],
  [AgencyType.Cybercrime]: [
    FieldOperationalRole.Dispatcher,
    FieldOperationalRole.AgencySupervisor,
  ],
  [AgencyType.ChildProtection]: [
    FieldOperationalRole.Dispatcher,
    FieldOperationalRole.AgencySupervisor,
  ],
  [AgencyType.GbvResponse]: [
    FieldOperationalRole.Dispatcher,
    FieldOperationalRole.AgencySupervisor,
  ],
  [AgencyType.EnvironmentalResponse]: [
    FieldOperationalRole.Dispatcher,
    FieldOperationalRole.AgencySupervisor,
  ],
  [AgencyType.PublicHealthEmergency]: [
    FieldOperationalRole.Dispatcher,
    FieldOperationalRole.AgencySupervisor,
  ],
  [AgencyType.StateEmergencyAgency]: [
    FieldOperationalRole.Dispatcher,
    FieldOperationalRole.AgencySupervisor,
  ],
  [AgencyType.TrafficManagement]: [
    FieldOperationalRole.PatrolOfficer,
    FieldOperationalRole.Dispatcher,
    FieldOperationalRole.AgencySupervisor,
  ],
  [AgencyType.PrivateSecurity]: [
    FieldOperationalRole.PatrolOfficer,
    FieldOperationalRole.CheckpointOfficer,
    FieldOperationalRole.AgencySupervisor,
  ],
  [AgencyType.LocalGovernment]: [
    FieldOperationalRole.Dispatcher,
    FieldOperationalRole.AgencySupervisor,
  ],
  [AgencyType.Other]: [
    FieldOperationalRole.Dispatcher,
    FieldOperationalRole.AgencySupervisor,
  ],
};

export function isOperationalRoleAllowedForAgencyType(
  agencyType: AgencyType,
  role: string | null | undefined,
): boolean {
  if (!role) return true;
  const allowed = AGENCY_TYPE_FIELD_ROLES[agencyType] ?? [];
  return allowed.includes(role as FieldOperationalRole);
}

export type AgencySelector = {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  agencyType: AgencyType;
  jurisdictionLevel: AgencyJurisdictionLevel;
  countryCode: string;
  stateCode: string | null;
  lgaCode: string | null;
  capabilities: AgencyCapability[];
  isActive: boolean;
  isFieldOperationsEnabled: boolean;
  isDispatchable: boolean;
  isDroneEnabled: boolean;
  isBroadcastAuthority: boolean;
};

export type AgencyUnitSelector = {
  id: string;
  agencyId: string;
  name: string;
  unitIdentifier: string;
  unitKind: AgencyUnitKind;
  parentUnitId: string | null;
  countryCode: string | null;
  stateCode: string | null;
  lgaCode: string | null;
  isActive: boolean;
};
