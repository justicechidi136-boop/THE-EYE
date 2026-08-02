import type {
  DroneDashboardView,
  DroneDeviceView,
  DroneOperatorDetailView,
  DroneEvidenceView,
  DroneFlightLogView,
  DroneGeofenceView,
  DroneHealthView,
  DroneMissionView,
  DroneNoFlyZoneView,
  DroneOperatorView,
} from "../types/admin-views";

function text(value: unknown, fallback = ""): string {
  return value == null ? fallback : String(value);
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toDroneDeviceView(record: Record<string, unknown>): DroneDeviceView {
  const lastGps = record.lastGps as Record<string, unknown> | null | undefined;
  return {
    id: text(record.id),
    deviceId: text(record.deviceId),
    model: text(record.model),
    manufacturer: text(record.manufacturer),
    serialNumber: text(record.serialNumber),
    status: text(record.status, "Offline"),
    healthStatus: text(record.healthStatus, "Healthy"),
    batteryLevel: num(record.batteryLevel),
    signalStrength: num(record.signalStrength),
    firmwareVersion: text(record.firmwareVersion, "—"),
    flightHours: num(record.flightHours) ?? 0,
    totalMissions: num(record.totalMissions) ?? 0,
    liveVideoCapable: Boolean(record.liveVideoCapable),
    lastGps:
      lastGps && lastGps.lat != null && lastGps.lng != null
        ? { lat: Number(lastGps.lat), lng: Number(lastGps.lng), at: lastGps.at ? text(lastGps.at) : null }
        : null,
    lastSeenAt: record.lastSeenAt ? text(record.lastSeenAt) : null,
    isActive: record.isActive !== false,
  };
}

export function toDroneMissionView(record: Record<string, unknown>): DroneMissionView {
  const target = record.target as Record<string, unknown> | null | undefined;
  const drone = record.drone as Record<string, unknown> | null | undefined;
  const incident = record.incident as Record<string, unknown> | null | undefined;
  return {
    id: text(record.id),
    missionCode: text(record.missionCode),
    title: text(record.title),
    description: record.description ? text(record.description) : null,
    status: text(record.status),
    priority: text(record.priority, "P3"),
    incidentId: record.incidentId ? text(record.incidentId) : null,
    incident: incident ? { id: text(incident.id), title: text(incident.title), status: text(incident.status) } : null,
    droneId: record.droneId ? text(record.droneId) : null,
    drone: drone ? toDroneDeviceView(drone) : null,
    operator: (record.operator as Record<string, unknown>) ?? null,
    commander: (record.commander as Record<string, unknown>) ?? null,
    target:
      target && target.lat != null && target.lng != null
        ? { lat: Number(target.lat), lng: Number(target.lng), address: target.address ? text(target.address) : null }
        : null,
    scheduledAt: record.scheduledAt ? text(record.scheduledAt) : null,
    launchedAt: record.launchedAt ? text(record.launchedAt) : null,
    completedAt: record.completedAt ? text(record.completedAt) : null,
    liveVideoStatus: text(record.liveVideoStatus, "Offline"),
    liveVideoSessionId: record.liveVideoSessionId ? text(record.liveVideoSessionId) : null,
    correlationId: record.correlationId ? text(record.correlationId) : null,
    createdAt: text(record.createdAt),
    updatedAt: text(record.updatedAt),
    latestTrack: (record.latestTrack as Record<string, unknown>) ?? null,
  };
}

export function toDroneDashboardView(record: Record<string, unknown>): DroneDashboardView {
  return {
    fleetActive: num(record.fleetActive) ?? 0,
    activeMissions: num(record.activeMissions) ?? 0,
    scheduledMissions: num(record.scheduledMissions) ?? 0,
    liveVideoStreams: num(record.liveVideoStreams) ?? 0,
    evidenceItems: num(record.evidenceItems) ?? 0,
    activeOperators: num(record.activeOperators) ?? 0,
    geofences: num(record.geofences) ?? 0,
    noFlyZones: num(record.noFlyZones) ?? 0,
  };
}

export function toDroneOperatorView(record: Record<string, unknown>): DroneOperatorView {
  return {
    id: text(record.id),
    name: text(record.fullName ?? record.name),
    email: record.email ? text(record.email) : null,
    callsign: record.callsign ? text(record.callsign) : null,
    operatorCode: record.operatorCode ? text(record.operatorCode) : record.operator_code ? text(record.operator_code) : null,
    operatorRole: text(record.operatorRole, "Operator"),
    certificationLevel: record.certificationLevel ? text(record.certificationLevel) : null,
    accountStatus: text(record.accountStatus, "Active"),
    availabilityStatus: text(record.availabilityStatus, "Unavailable"),
    country: record.country ? text(record.country) : null,
    state: record.state ? text(record.state) : null,
    lga: record.lga ? text(record.lga) : null,
    assignedOperatingBase:
      record.assignedOperatingBase ? text(record.assignedOperatingBase) : record.assigned_operating_base ? text(record.assigned_operating_base) : null,
    licenceWarningLevel: text(record.licenceWarningLevel, "none"),
    activeAssignmentCount: num(record.activeAssignmentCount) ?? 0,
    isActive: record.isActive !== false,
  };
}

export function toDroneOperatorDetailView(record: Record<string, unknown>): DroneOperatorDetailView {
  const base = toDroneOperatorView(record);
  const currentAssignment = (record.currentAssignment as Record<string, unknown> | null | undefined) ?? null;
  const missionStats = (record.missionStats as Record<string, unknown> | null | undefined) ?? {};
  const compliance = (record.complianceSummary as Record<string, unknown> | null | undefined) ?? {};
  const safety = (record.safetySummary as Record<string, unknown> | null | undefined) ?? {};
  const documents = Array.isArray(record.documents) ? record.documents : [];
  const auditEntries = Array.isArray(record.auditEntries) ? record.auditEntries : [];
  const assignedDrone = (record.assignedDrone as Record<string, unknown> | null | undefined) ?? null;

  return {
    ...base,
    phone: record.phone ? text(record.phone) : null,
    assignedDroneId: record.assignedDroneId ? text(record.assignedDroneId) : assignedDrone?.id ? text(assignedDrone.id) : null,
    assignedDroneDeviceId:
      record.assignedDroneDeviceId ? text(record.assignedDroneDeviceId) : assignedDrone?.deviceId ? text(assignedDrone.deviceId) : null,
    currentAssignment: currentAssignment
      ? {
          missionId: text(currentAssignment.missionId ?? currentAssignment.id),
          missionCode: currentAssignment.missionCode ? text(currentAssignment.missionCode) : null,
          status: currentAssignment.status ? text(currentAssignment.status) : null,
        }
      : null,
    complianceSummary: {
      licenceExpiryAt: compliance.licenceExpiryAt ? text(compliance.licenceExpiryAt) : null,
      certificateExpiryAt: compliance.certificateExpiryAt ? text(compliance.certificateExpiryAt) : null,
      medicalExpiryAt: compliance.medicalExpiryAt ? text(compliance.medicalExpiryAt) : null,
    },
    missionStats: {
      totalMissions: num(missionStats.totalMissions) ?? 0,
      completedMissions: num(missionStats.completedMissions) ?? 0,
      abortedMissions: num(missionStats.abortedMissions) ?? 0,
      hoursFlown: num(missionStats.hoursFlown) ?? 0,
    },
    safetySummary: {
      incidentsInvolved: num(safety.incidentsInvolved) ?? 0,
      warningCount: num(safety.warningCount) ?? 0,
      lastIncidentAt: safety.lastIncidentAt ? text(safety.lastIncidentAt) : null,
    },
    documents: documents.map((entry) => {
      const document = entry as Record<string, unknown>;
      return {
        id: text(document.id),
        type: text(document.type, "Unknown"),
        status: text(document.status, "Pending"),
        expiresAt: document.expiresAt ? text(document.expiresAt) : null,
      };
    }),
    auditEntries: auditEntries.map((entry) => {
      const audit = entry as Record<string, unknown>;
      return {
        id: text(audit.id),
        action: text(audit.action, "updated"),
        actor: text(audit.actor, "system"),
        createdAt: text(audit.createdAt),
      };
    }),
  };
}

export function toDroneEvidenceView(record: Record<string, unknown>): DroneEvidenceView {
  const mission = record.mission as Record<string, unknown> | undefined;
  const incident = record.incident as Record<string, unknown> | undefined;
  return {
    id: text(record.id),
    missionId: text(record.missionId),
    incidentId: record.incidentId ? text(record.incidentId) : null,
    mediaType: text(record.mediaType),
    title: text(record.title),
    capturedAt: text(record.capturedAt),
    mission: mission ? { missionCode: text(mission.missionCode), title: text(mission.title) } : undefined,
    incident: incident ? { id: text(incident.id), title: text(incident.title) } : undefined,
  };
}

export function toDroneGeofenceView(record: Record<string, unknown>): DroneGeofenceView {
  return {
    id: text(record.id),
    name: text(record.name),
    fenceType: text(record.fenceType, "Operational"),
    description: record.description ? text(record.description) : null,
    isActive: record.isActive !== false,
    updatedAt: text(record.updatedAt),
  };
}

export function toDroneNoFlyZoneView(record: Record<string, unknown>): DroneNoFlyZoneView {
  return {
    id: text(record.id),
    name: text(record.name),
    reason: record.reason ? text(record.reason) : null,
    isActive: record.isActive !== false,
    updatedAt: text(record.updatedAt),
  };
}

export function toDroneFlightLogView(record: Record<string, unknown>): DroneFlightLogView {
  const drone = record.drone as Record<string, unknown> | undefined;
  const mission = record.mission as Record<string, unknown> | undefined;
  return {
    id: text(record.id),
    eventType: text(record.eventType),
    message: text(record.message),
    recordedAt: text(record.recordedAt),
    drone: drone ? { deviceId: text(drone.deviceId), model: text(drone.model) } : undefined,
    mission: mission ? { missionCode: text(mission.missionCode), title: text(mission.title) } : undefined,
  };
}

export function toDroneHealthView(record: Record<string, unknown>): DroneHealthView {
  return {
    ...toDroneDeviceView(record),
    latestHealth: (record.latestHealth as Record<string, unknown>) ?? null,
  };
}
