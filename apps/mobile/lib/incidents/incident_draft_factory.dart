import "dart:math";

import "package:geolocator/geolocator.dart";

import "../contracts/the_eye_enums.dart";
import "../evidence/local_evidence_attachment.dart";
import "incident_draft.dart";

final _random = Random();

String createClientSubmissionId() {
  return "submit-${DateTime.now().microsecondsSinceEpoch}-${_random.nextInt(1 << 20)}";
}

String normalizeIncidentDescription(String raw, {required String fallback}) {
  final trimmed = raw.trim();
  if (trimmed.length >= TheEyeEnums.descriptionMinLength) return trimmed;
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
}) {
  return IncidentDraft(
    clientSubmissionId: clientSubmissionId ?? createClientSubmissionId(),
    type: type,
    description:
        normalizeIncidentDescription(description, fallback: title ?? type),
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
  );
}
