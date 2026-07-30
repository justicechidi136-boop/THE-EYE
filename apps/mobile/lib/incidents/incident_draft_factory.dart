import "dart:math";

import "package:geolocator/geolocator.dart";

import "../location/location_permission_service.dart";
import "../contracts/the_eye_enums.dart";
import "../evidence/local_evidence_attachment.dart";
import "incident_draft.dart";
import "../voice/voice_report_validation.dart";

final _random = Random();

String createClientSubmissionId() {
  return "submit-${DateTime.now().microsecondsSinceEpoch}-${_random.nextInt(1 << 20)}";
}

String normalizeIncidentDescription(
  String raw, {
  required String fallback,
  bool hasVoiceAttachment = false,
}) {
  final trimmed = raw.trim();
  if (trimmed.length >= TheEyeEnums.descriptionMinLength) return trimmed;
  if (hasVoiceAttachment) {
    return normalizeVoiceOnlyDescription(fallback.trim().isEmpty ? "report" : fallback.trim());
  }
  final candidate = fallback.trim();
  if (candidate.length >= TheEyeEnums.descriptionMinLength) return candidate;
  return "$candidate submitted via THE EYE mobile.";
}

IncidentDraft buildIncidentDraft({
  required String type,
  required String description,
  required Position position,
  bool anonymous = true,
  bool notifyEmergencyContacts = false,
  String? manualAddress,
  double? manualLatitude,
  double? manualLongitude,
  List<String> emergencyContactIds = const [],
  MissingPersonDetails? missingPerson,
  StolenVehicleDetails? stolenVehicle,
  String? title,
  List<LocalEvidenceAttachment> localMedia = const [],
  String? clientSubmissionId,
  String? emergencyCategory,
}) {
  final hasVoice = draftHasVoiceAttachment(localMedia: localMedia);
  return IncidentDraft(
    clientSubmissionId: clientSubmissionId ?? createClientSubmissionId(),
    type: type,
    description: normalizeIncidentDescription(
      description,
      fallback: title ?? type,
      hasVoiceAttachment: hasVoice,
    ),
    latitude: position.latitude,
    longitude: position.longitude,
    locationAccuracyMeters: position.accuracy,
    capturedAt: position.timestamp.toUtc(),
    manualLatitude: manualLatitude,
    manualLongitude: manualLongitude,
    manualAddress: manualAddress,
    title: title,
    anonymous: anonymous,
    notifyEmergencyContacts: notifyEmergencyContacts,
    emergencyContactIds: emergencyContactIds,
    missingPerson: missingPerson,
    stolenVehicle: stolenVehicle,
    localMedia: localMedia,
    emergencyCategory: emergencyCategory,
  );
}

IncidentDraft buildEmergencyIncidentDraft({
  required LocationAccessResult access,
  required String type,
  required String description,
  bool anonymous = false,
  bool notifyEmergencyContacts = true,
  String? title,
  String? clientSubmissionId,
  String? emergencyCategory,
  List<String> emergencyContactIds = const [],
  List<LocalEvidenceAttachment> localMedia = const [],
}) {
  final position = access.position;
  final hasVoice = draftHasVoiceAttachment(localMedia: localMedia);
  return IncidentDraft(
    clientSubmissionId: clientSubmissionId ?? createClientSubmissionId(),
    type: type,
    description: normalizeIncidentDescription(
      description,
      fallback: title ?? type,
      hasVoiceAttachment: hasVoice,
    ),
    latitude: position?.latitude,
    longitude: position?.longitude,
    locationAccuracyMeters: position?.accuracy,
    capturedAt: position?.timestamp.toUtc() ?? DateTime.now().toUtc(),
    title: title,
    anonymous: anonymous,
    notifyEmergencyContacts: notifyEmergencyContacts,
    emergencyContactIds: emergencyContactIds,
    localMedia: localMedia,
    emergencyCategory: emergencyCategory,
    locationMetadata: locationMetadataFields(access),
  );
}

IncidentDraft buildSosIncidentDraft({
  required LocationAccessResult access,
  required String description,
  bool anonymous = false,
  bool notifyEmergencyContacts = true,
  bool silent = false,
  String? title,
  String? clientSubmissionId,
  String? emergencyCategory,
}) {
  final position = access.position;
  return IncidentDraft(
    clientSubmissionId: clientSubmissionId ?? createClientSubmissionId(),
    type: IncidentType.sos,
    description: normalizeIncidentDescription(
      description,
      fallback: title ?? "SOS emergency",
    ),
    latitude: position?.latitude,
    longitude: position?.longitude,
    locationAccuracyMeters: position?.accuracy,
    capturedAt: position?.timestamp.toUtc() ?? DateTime.now().toUtc(),
    title: title ?? "SOS emergency",
    anonymous: anonymous,
    notifyEmergencyContacts: notifyEmergencyContacts,
    silent: silent,
    emergencyCategory: emergencyCategory,
    locationMetadata: locationMetadataFields(access),
  );
}
