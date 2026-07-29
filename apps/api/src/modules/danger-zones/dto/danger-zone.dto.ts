export type CreateDangerZoneDto = {
  incidentId: string;
  innerRadiusMeters?: number;
  warningRadiusMeters?: number;
  outerAwarenessRadiusMeters?: number;
  publicMessage?: string;
  avoidanceInstruction?: string;
  severity?: string;
  expiryMinutes?: number;
  emergencyOverride?: boolean;
};

export type UpdateDangerZoneDto = {
  innerRadiusMeters?: number;
  warningRadiusMeters?: number;
  outerAwarenessRadiusMeters?: number;
  publicMessage?: string;
  avoidanceInstruction?: string;
  severity?: string;
  expiryTime?: string;
};

export type AllClearDangerZoneDto = {
  status: "Contained" | "Monitoring" | "AreaCalm" | "AllClear" | "FalseAlertCancelled";
  reason: string;
};

export type AcknowledgeSafetyAlertDto = {
  deviceSecret?: string;
};

export function validateCreateDangerZoneDto(dto: CreateDangerZoneDto) {
  if (!dto.incidentId?.trim()) throw new Error("incidentId is required");
}
