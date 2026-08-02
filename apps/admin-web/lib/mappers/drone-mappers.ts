import type {
  DroneDashboardView,
  DroneDeviceView,
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
    name: text(record.name),
    email: record.email ? text(record.email) : null,
    callsign: record.callsign ? text(record.callsign) : null,
    operatorRole: text(record.operatorRole, "Operator"),
    certificationLevel: record.certificationLevel ? text(record.certificationLevel) : null,
    isActive: record.isActive !== false,
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
