import {
  BroadcastStatus,
  BroadcastType,
  FirmwareSignatureStatus,
  IncidentMediaType,
  IncidentPriority,
  IncidentStatus,
  IncidentType,
  SmartwatchConnectivityMode,
  SmartwatchEmergencyMode,
  SmartwatchOfflineEventType,
  SmartwatchPairingMethod,
} from "./enums";

export type ApiFieldSpec = {
  type: "string" | "number" | "boolean" | "object" | "array";
  required?: boolean;
  min?: number;
  max?: number;
  enumRef?: string;
};

export type ApiEndpointContract = {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  body?: Record<string, ApiFieldSpec>;
};

export const API_VERSION_PREFIX = "/v1";

export const apiEnumValues = {
  IncidentType: Object.values(IncidentType),
  IncidentStatus: Object.values(IncidentStatus),
  IncidentPriority: Object.values(IncidentPriority),
  BroadcastType: Object.values(BroadcastType),
  BroadcastStatus: Object.values(BroadcastStatus),
  SmartwatchConnectivityMode: Object.values(SmartwatchConnectivityMode),
  SmartwatchPairingMethod: Object.values(SmartwatchPairingMethod),
  SmartwatchEmergencyMode: Object.values(SmartwatchEmergencyMode),
  SmartwatchOfflineEventType: Object.values(SmartwatchOfflineEventType),
  FirmwareSignatureStatus: Object.values(FirmwareSignatureStatus),
  IncidentMediaType: Object.values(IncidentMediaType),
} as const;

const gpsFields: Record<string, ApiFieldSpec> = {
  latitude: { type: "number", required: true, min: -90, max: 90 },
  longitude: { type: "number", required: true, min: -180, max: 180 },
  accuracy: { type: "number", min: 0 },
  speed: { type: "number" },
  heading: { type: "number", min: 0, max: 360 },
  altitude: { type: "number" },
  capturedAt: { type: "string" },
  sourceDeviceId: { type: "string" },
};

export const mobileApiContracts: Record<string, ApiEndpointContract> = {
  "liveVideo.start": {
    method: "POST",
    path: "/live-video/incidents/:incidentId/start",
    body: {
      ...gpsFields,
      lowBandwidthMode: { type: "boolean" },
    },
  },
  "liveVideo.locationUpdate": {
    method: "POST",
    path: "/live-video/sessions/:sessionId/location",
    body: {
      ...gpsFields,
      capturedAt: { type: "string", required: true },
    },
  },
  "smartwatch.register": {
    method: "POST",
    path: "/smartwatch/devices/register",
    body: {
      deviceId: { type: "string", required: true },
      provider: { type: "string", required: true },
      displayName: { type: "string" },
      connectivityMode: { type: "string", enumRef: "SmartwatchConnectivityMode" },
      preferredMode: { type: "string", enumRef: "SmartwatchConnectivityMode" },
      pairingMethod: { type: "string", enumRef: "SmartwatchPairingMethod" },
      failoverEnabled: { type: "boolean" },
      criticalAlertsEnabled: { type: "boolean" },
    },
  },
  "smartwatch.gps": {
    method: "POST",
    path: "/smartwatch/devices/:deviceId/gps",
    body: {
      deviceId: { type: "string" },
      deviceSecret: { type: "string" },
      ...gpsFields,
      sourceMode: { type: "string", enumRef: "SmartwatchConnectivityMode" },
      batteryLevel: { type: "number", min: 0, max: 100 },
      signalStrength: { type: "number", min: 0, max: 100 },
    },
  },
  "smartwatch.sos": {
    method: "POST",
    path: "/smartwatch/sos",
    body: {
      deviceId: { type: "string" },
      deviceSecret: { type: "string" },
      ...gpsFields,
      sourceMode: { type: "string", enumRef: "SmartwatchConnectivityMode" },
      batteryLevel: { type: "number", min: 0, max: 100 },
      signalStrength: { type: "number", min: 0, max: 100 },
      description: { type: "string" },
      sourceDeviceId: { type: "string" },
      emergencyMode: { type: "string", enumRef: "SmartwatchEmergencyMode" },
      longPressDurationMs: { type: "number", min: 3000 },
    },
  },
  "smartwatch.heartbeat": {
    method: "POST",
    path: "/smartwatch/devices/:deviceId/heartbeat",
    body: {
      deviceId: { type: "string" },
      deviceSecret: { type: "string" },
      connectivityMode: { type: "string", enumRef: "SmartwatchConnectivityMode" },
      pairedPhoneAvailable: { type: "boolean" },
      internetAvailable: { type: "boolean" },
      batteryLevel: { type: "number", min: 0, max: 100 },
      signalStrength: { type: "number", min: 0, max: 100 },
      firmwareVersion: { type: "string" },
      firmwareSignatureStatus: { type: "string", enumRef: "FirmwareSignatureStatus" },
    },
  },
  "smartwatch.offlineSync": {
    method: "POST",
    path: "/smartwatch/devices/:deviceId/offline-sync",
    body: {
      deviceId: { type: "string" },
      deviceSecret: { type: "string" },
      events: { type: "array", required: true },
    },
  },
  "incidents.report": {
    method: "POST",
    path: "/incidents/report",
    body: {
      type: { type: "string", required: true, enumRef: "IncidentType" },
      description: { type: "string", required: true },
      latitude: { type: "number", required: true, min: -90, max: 90 },
      longitude: { type: "number", required: true, min: -180, max: 180 },
      manualLatitude: { type: "number", min: -90, max: 90 },
      manualLongitude: { type: "number", min: -180, max: 180 },
      manualAddress: { type: "string" },
      anonymous: { type: "boolean" },
      notifyEmergencyContacts: { type: "boolean" },
      priority: { type: "string", enumRef: "IncidentPriority" },
    },
  },
};

export const reportIncidentValidation = {
  descriptionMinLength: 5,
  mediaMaxCount: 10,
  sosLongPressMinMs: 3000,
  offlineSyncMaxEvents: 100,
} as const;
