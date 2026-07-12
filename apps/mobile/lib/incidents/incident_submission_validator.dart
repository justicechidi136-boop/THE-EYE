import "dart:io";

import "../evidence/evidence_constants.dart";
import "../evidence/local_evidence_attachment.dart";
import "../contracts/the_eye_enums.dart";
import "incident_draft.dart";
import "incident_submission_result.dart";

class IncidentSubmissionValidator {
  const IncidentSubmissionValidator();

  IncidentSubmissionResult? validate(IncidentDraft draft,
      {required bool hasAccessToken}) {
    final errors = <String, String>{};

    if (!IncidentType.all.contains(draft.type)) {
      errors["type"] = "Unsupported incident type.";
    }

    final description = draft.description.trim();
    if (description.length < TheEyeEnums.descriptionMinLength) {
      errors["description"] =
          "Description must be at least ${TheEyeEnums.descriptionMinLength} characters.";
    }

    if (!_isCoordinate(draft.latitude, -90, 90)) {
      errors["latitude"] = "Latitude is required.";
    }
    if (!_isCoordinate(draft.longitude, -180, 180)) {
      errors["longitude"] = "Longitude is required.";
    }

    if (draft.manualLatitude != null &&
        !_isCoordinate(draft.manualLatitude!, -90, 90)) {
      errors["manualLatitude"] = "Manual latitude is invalid.";
    }
    if (draft.manualLongitude != null &&
        !_isCoordinate(draft.manualLongitude!, -180, 180)) {
      errors["manualLongitude"] = "Manual longitude is invalid.";
    }

    if (!draft.anonymous && !hasAccessToken) {
      errors["anonymous"] = "Sign in is required for identified reports.";
    }

    if (draft.type == IncidentType.missingPerson &&
        (draft.missingPerson?.fullName.trim().isEmpty ?? true)) {
      errors["missingPerson.fullName"] =
          "Full name is required for missing person reports.";
    }

    if (draft.type == IncidentType.stolenVehicle) {
      if (draft.stolenVehicle?.plateNumber.trim().isEmpty ?? true) {
        errors["stolenVehicle.plateNumber"] =
            "Plate number is required for stolen vehicle reports.";
      }
      if (draft.stolenVehicle?.make.trim().isEmpty ?? true) {
        errors["stolenVehicle.make"] = "Vehicle make is required.";
      }
      if (draft.stolenVehicle?.model.trim().isEmpty ?? true) {
        errors["stolenVehicle.model"] = "Vehicle model is required.";
      }
    }

    final totalMedia = draft.media.length + draft.localMedia.length;
    if (totalMedia > TheEyeEnums.mediaMaxCount) {
      errors["media"] =
          "At most ${TheEyeEnums.mediaMaxCount} media files can be attached.";
    }

    for (final media in draft.media) {
      if (media.bucket.isEmpty ||
          media.objectKey.isEmpty ||
          media.contentType.isEmpty ||
          media.fileHash.isEmpty) {
        errors["media"] =
            "Each media attachment needs bucket, object key, content type, and file hash.";
        break;
      }
    }

    for (final attachment in draft.localMedia) {
      if (attachment.fileHash.isEmpty || attachment.uploadPath.isEmpty) {
        errors["media"] = "Attached evidence is incomplete.";
        break;
      }
      final file = File(attachment.uploadPath);
      if (!file.existsSync()) {
        errors["media"] = "Attached evidence file is missing.";
        break;
      }
      if (attachment.sizeBytes <= 0 ||
          attachment.sizeBytes > EvidenceLimits.maxFileBytes) {
        errors["media"] = "Attached evidence file size is invalid.";
        break;
      }
    }

    if (errors.isEmpty) return null;

    return IncidentSubmissionResult(
      status: IncidentSubmissionStatus.validationError,
      userMessage: "Check the highlighted fields before submitting.",
      fieldErrors: errors,
    );
  }

  bool _isCoordinate(double value, double min, double max) {
    return !value.isNaN && value >= min && value <= max;
  }
}
