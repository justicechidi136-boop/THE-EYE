import {
  DroneOperatorAccountStatus,
  DroneQualificationStatus,
  DroneVerificationStatus,
} from "@the-eye/shared";

export type ComplianceCheck = {
  code: string;
  passed: boolean;
  message: string;
};

export type OperatorComplianceContext = {
  accountStatus: string;
  availabilityStatus: string;
  licences: Array<{ verificationStatus: string; expiryDate: Date | null }>;
  certifications: Array<{ certificationType: string; verificationStatus: string; expiryDate: Date | null }>;
  qualifications: Array<{ droneDeviceId: string | null; droneModel: string | null; status: string; expiresAt: Date | null }>;
  activeAssignmentCount: number;
  maximumConcurrentMissions: number;
  assignmentAccepted: boolean;
};

export type PreflightContext = OperatorComplianceContext & {
  droneActive: boolean;
  droneMaintenanceCurrent: boolean;
  batteryHealthy: boolean;
  gpsHealthy: boolean;
  geofenceReviewed: boolean;
  noFlyZonesReviewed: boolean;
  weatherCheckRecorded: boolean;
  missionReferencePresent: boolean;
};

const now = () => new Date();

export function isLicenceValid(licence: { verificationStatus: string; expiryDate: Date | null }) {
  if (licence.verificationStatus !== DroneVerificationStatus.Verified) return false;
  if (licence.expiryDate && licence.expiryDate <= now()) return false;
  return true;
}

export function isCertificationValid(cert: { verificationStatus: string; expiryDate: Date | null }) {
  if (cert.verificationStatus !== DroneVerificationStatus.Verified) return false;
  if (cert.expiryDate && cert.expiryDate <= now()) return false;
  return true;
}

export function isQualificationValidForDrone(
  qualifications: OperatorComplianceContext["qualifications"],
  droneId: string | null,
  droneModel: string | null,
) {
  return qualifications.some((q) => {
    if (q.status !== DroneQualificationStatus.Active) return false;
    if (q.expiresAt && q.expiresAt <= now()) return false;
    if (droneId && q.droneDeviceId === droneId) return true;
    if (droneModel && q.droneModel === droneModel) return true;
    return false;
  });
}

export function runOperatorAssignmentChecks(ctx: OperatorComplianceContext): ComplianceCheck[] {
  const checks: ComplianceCheck[] = [];
  checks.push({
    code: "operator_active",
    passed: ctx.accountStatus === DroneOperatorAccountStatus.Active || ctx.accountStatus === DroneOperatorAccountStatus.Assigned,
    message: "Operator account must be active",
  });
  const validLicence = ctx.licences.some(isLicenceValid);
  checks.push({
    code: "licence_valid",
    passed: validLicence,
    message: "Operator must have a verified, unexpired licence",
  });
  checks.push({
    code: "mission_capacity",
    passed: ctx.activeAssignmentCount < ctx.maximumConcurrentMissions,
    message: "Operator has reached maximum concurrent missions",
  });
  return checks;
}

export function runPreflightChecks(ctx: PreflightContext, requiredCertTypes: string[] = []): ComplianceCheck[] {
  const checks = runOperatorAssignmentChecks(ctx);
  checks.push({
    code: "assignment_accepted",
    passed: ctx.assignmentAccepted,
    message: "Operator must accept mission assignment",
  });
  for (const certType of requiredCertTypes) {
    const valid = ctx.certifications.some((c) => c.certificationType === certType && isCertificationValid(c));
    checks.push({
      code: `certification_${certType}`,
      passed: valid,
      message: `Required certification ${certType} must be verified and unexpired`,
    });
  }
  checks.push(
    { code: "drone_active", passed: ctx.droneActive, message: "Assigned drone must be active" },
    { code: "maintenance_current", passed: ctx.droneMaintenanceCurrent, message: "Drone maintenance must be current" },
    { code: "battery_healthy", passed: ctx.batteryHealthy, message: "Drone battery health must be acceptable" },
    { code: "gps_healthy", passed: ctx.gpsHealthy, message: "Drone GPS must be healthy" },
    { code: "geofence_reviewed", passed: ctx.geofenceReviewed, message: "Geofence must be reviewed" },
    { code: "no_fly_reviewed", passed: ctx.noFlyZonesReviewed, message: "No-fly zones must be reviewed" },
    { code: "weather_check", passed: ctx.weatherCheckRecorded, message: "Weather check must be recorded" },
    { code: "mission_reference", passed: ctx.missionReferencePresent, message: "Mission or incident reference must be present" },
  );
  return checks;
}

export function expiryWarningLevel(expiryDate: Date | null): "none" | "90d" | "60d" | "30d" | "7d" | "expired" {
  if (!expiryDate) return "none";
  const ms = expiryDate.getTime() - now().getTime();
  if (ms <= 0) return "expired";
  const days = ms / (1000 * 60 * 60 * 24);
  if (days <= 7) return "7d";
  if (days <= 30) return "30d";
  if (days <= 60) return "60d";
  if (days <= 90) return "90d";
  return "none";
}
