/// Canonical API enum values mirrored from `@the-eye/shared`.
/// Keep in sync with `packages/shared/dist/contracts.json`.
abstract final class TheEyeEnums {
  static const apiVersionPrefix = "/v1";
  static const defaultApiBaseUrl = "http://localhost:4000/v1";
  static const descriptionMinLength = 5;
  static const mediaMaxCount = 10;
  static const sosLongPressMinMs = 3000;
  static const offlineSyncMaxEvents = 100;
}

abstract final class IncidentType {
  static const emergency = "Emergency";
  static const crime = "Crime";
  static const accident = "Accident";
  static const fire = "Fire";
  static const medical = "Medical";
  static const communitySafety = "CommunitySafety";
  static const kidnapping = "Kidnapping";
  static const abuse = "Abuse";
  static const suspiciousActivity = "SuspiciousActivity";
  static const missingPerson = "MissingPerson";
  static const stolenVehicle = "StolenVehicle";
  static const sos = "SOS";

  static const all = <String>[
    emergency,
    crime,
    accident,
    fire,
    medical,
    communitySafety,
    kidnapping,
    abuse,
    suspiciousActivity,
    missingPerson,
    stolenVehicle,
    sos,
  ];
}

abstract final class IncidentStatus {
  static const submitted = "Submitted";
  static const received = "Received";
  static const verifying = "Verifying";
  static const verified = "Verified";
  static const assigned = "Assigned";
  static const responding = "Responding";
  static const resolved = "Resolved";
  static const closed = "Closed";
  static const falseReport = "FalseReport";
}

abstract final class IncidentPriority {
  static const p1LifeThreatening = "P1LifeThreatening";
  static const p2ActiveCrimeAccident = "P2ActiveCrimeAccident";
  static const p3SuspiciousActivity = "P3SuspiciousActivity";
  static const p4GeneralSafety = "P4GeneralSafety";
}

abstract final class BroadcastType {
  static const emergency = "Emergency";
  static const crime = "Crime";
  static const accident = "Accident";
  static const missingPerson = "MissingPerson";
  static const stolenVehicle = "StolenVehicle";
  static const governmentAlert = "GovernmentAlert";
  static const communityWarning = "CommunityWarning";
}

abstract final class BroadcastStatus {
  static const draft = "Draft";
  static const pendingApproval = "PendingApproval";
  static const published = "Published";
  static const expired = "Expired";
  static const cancelled = "Cancelled";
  static const rejected = "Rejected";
}

abstract final class SmartwatchConnectivityMode {
  static const pairedPhone = "PairedPhone";
  static const standaloneCellular = "StandaloneCellular";
}

abstract final class SmartwatchPairingMethod {
  static const qrCode = "QrCode";
  static const bluetooth = "Bluetooth";
  static const pairingCode = "PairingCode";
  static const nfc = "Nfc";
}

abstract final class SmartwatchEmergencyMode {
  static const silentSos = "SilentSOS";
  static const normalSos = "NormalSOS";
  static const medicalSos = "MedicalSOS";
  static const kidnappingSos = "KidnappingSOS";
  static const fireSos = "FireSOS";
  static const childSos = "ChildSOS";
  static const womenSafetySos = "WomenSafetySOS";
}

abstract final class SmartwatchOfflineEventType {
  static const gps = "GPS";
  static const sos = "SOS";
  static const media = "Media";
  static const heartbeat = "Heartbeat";
  static const incidentAcknowledgement = "IncidentAcknowledgement";
}

abstract final class FirmwareSignatureStatus {
  static const unknown = "Unknown";
  static const valid = "Valid";
  static const invalid = "Invalid";
  static const revoked = "Revoked";
}

abstract final class IncidentMediaType {
  static const image = "Image";
  static const video = "Video";
  static const audio = "Audio";
  static const document = "Document";
  static const liveVideoRecording = "LiveVideoRecording";
}
