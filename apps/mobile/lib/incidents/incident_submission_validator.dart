import "dart:io";

import "../contracts/the_eye_enums.dart";
import "../evidence/evidence_policy.dart";
import "../voice/voice_report_validation.dart";
import "incident_draft.dart";
import "incident_submission_result.dart";

class IncidentSubmissionValidator {
  const IncidentSubmissionValidator();
  static const _policy = EvidencePolicy.incident;

  IncidentSubmissionResult? validate(IncidentDraft draft,
      {required bool hasAccessToken}) {
    final errors = <String, String>{};

    if (!IncidentType.all.contains(draft.type)) {
      errors["type"] = "Unsupported incident type.";
    }

    final description = draft.description.trim();
    final localMedia = draft.localMedia;
    if (!hasValidReportNarrative(description: description, localMedia: localMedia)) {
      errors["description"] =
          "Add a description, voice recording, or photo/video evidence.";
    }

    if (draft.latitude != null &&
        !_isCoordinate(draft.latitude!, -90, 90) &&
        !_allowsPendingLocation(draft)) {
      errors["latitude"] = "Latitude is required.";
    }
    if (draft.longitude != null &&
        !_isCoordinate(draft.longitude!, -180, 180) &&
        !_allowsPendingLocation(draft)) {
      errors["longitude"] = "Longitude is required.";
    }
    if ((draft.latitude == null || draft.longitude == null) &&
        !_allowsPendingLocation(draft) &&
        draft.type != IncidentType.sos &&
        draft.type != IncidentType.emergency) {
      errors["latitude"] = "Latitude is required.";
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
    if (totalMedia > _policy.maxFiles) {
      errors["media"] =
          "At most ${_policy.maxFiles} media files can be attached.";
    }

    final localPhotoCount =
        draft.localMedia.where((item) => item.isImage).length;
    final localVideoCount =
        draft.localMedia.where((item) => item.isVideo).length;
    final localAudioCount =
        draft.localMedia.where((item) => item.isAudio).length;
    if (localPhotoCount > _policy.maxPhotos) {
      errors["media"] = "At most ${_policy.maxPhotos} photos can be attached.";
    } else if (localVideoCount > _policy.maxVideos) {
      errors["media"] = "At most ${_policy.maxVideos} videos can be attached.";
    } else if (localAudioCount > _policy.maxAudio) {
      errors["media"] = "At most ${_policy.maxAudio} audio files can be attached.";
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

    var totalBytes = 0;
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
          attachment.sizeBytes > _policy.maxFileSize) {
        errors["media"] = "Attached evidence file size is invalid.";
        break;
      }
      if (!_policy.supportedMimeTypes.contains(attachment.contentType)) {
        errors["media"] = "Attached evidence file type is not supported.";
        break;
      }
      totalBytes += attachment.sizeBytes;
      if (totalBytes > _policy.maxTotalBytes) {
        errors["media"] = "Attached evidence exceeds total upload allowance.";
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

  bool _allowsPendingLocation(IncidentDraft draft) {
    final status = draft.locationMetadata["locationStatus"];
    if (status != "pending" &&
        status != "denied" &&
        status != "serviceDisabled" &&
        status != "unavailable") {
      return false;
    }
    return draft.type == IncidentType.sos ||
        draft.type == IncidentType.emergency;
  }
}
