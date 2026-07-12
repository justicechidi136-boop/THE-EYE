import "dart:io";
import "dart:typed_data";

import "../contracts/the_eye_enums.dart";
import "evidence_constants.dart";

class EvidenceValidationException implements Exception {
  EvidenceValidationException(this.message);

  final String message;

  @override
  String toString() => message;
}

class EvidenceValidation {
  static String? extensionForFileName(String fileName) {
    final dot = fileName.lastIndexOf(".");
    if (dot < 0) return null;
    return fileName.substring(dot).toLowerCase();
  }

  static String normalizeMimeType(String? mimeType,
      {required String fileName}) {
    final normalized = mimeType?.split(";").first.trim().toLowerCase();
    if (normalized != null && normalized.isNotEmpty) return normalized;
    final extension = extensionForFileName(fileName);
    return switch (extension) {
      ".jpg" || ".jpeg" => "image/jpeg",
      ".png" => "image/png",
      ".webp" => "image/webp",
      ".mp4" => "video/mp4",
      ".webm" => "video/webm",
      ".mp3" || ".mpeg" => "audio/mpeg",
      ".m4a" => "audio/mp4",
      _ => "application/octet-stream",
    };
  }

  static Future<void> validateFile({
    required String path,
    required String fileName,
    required String mediaType,
    String? mimeType,
    int? durationSeconds,
  }) async {
    final file = File(path);
    if (!await file.exists()) {
      throw EvidenceValidationException("Selected file is missing.");
    }

    final sizeBytes = await file.length();
    if (sizeBytes <= 0 || sizeBytes > EvidenceLimits.maxFileBytes) {
      throw EvidenceValidationException(
          "Evidence must be between 1 byte and 100 MB.");
    }

    final extension = extensionForFileName(fileName);
    if (extension == null || !EvidenceExtensions.allowed.contains(extension)) {
      throw EvidenceValidationException("Unsupported file extension.");
    }

    final normalizedMime = normalizeMimeType(mimeType, fileName: fileName);
    if (!EvidenceMimeTypes.allowed.contains(normalizedMime)) {
      throw EvidenceValidationException("Unsupported evidence file type.");
    }

    if (!_mediaTypeMatchesMime(mediaType, normalizedMime)) {
      throw EvidenceValidationException(
          "File type does not match selected evidence category.");
    }

    final bytes = await file.openRead(0, 16).fold<Uint8List>(
          Uint8List(0),
          (previous, element) => Uint8List.fromList([...previous, ...element]),
        );
    if (!_hasValidMagicBytes(normalizedMime, bytes)) {
      throw EvidenceValidationException(
          "File appears corrupt or is not a supported evidence format.");
    }

    if (mediaType == IncidentMediaType.video &&
        durationSeconds != null &&
        durationSeconds > EvidenceLimits.maxVideoDurationSeconds) {
      throw EvidenceValidationException(
          "Video evidence must be ${EvidenceLimits.maxVideoDurationSeconds} seconds or shorter.");
    }
  }

  static bool _mediaTypeMatchesMime(String mediaType, String mimeType) {
    return switch (mediaType) {
      IncidentMediaType.image => EvidenceMimeTypes.image.contains(mimeType),
      IncidentMediaType.video => EvidenceMimeTypes.video.contains(mimeType),
      IncidentMediaType.audio => EvidenceMimeTypes.audio.contains(mimeType),
      _ => false,
    };
  }

  static bool _hasValidMagicBytes(String mimeType, Uint8List bytes) {
    if (bytes.isEmpty) return false;
    if (EvidenceMimeTypes.image.contains(mimeType)) {
      if (mimeType == "image/jpeg") {
        return bytes.length >= 3 &&
            bytes[0] == 0xFF &&
            bytes[1] == 0xD8 &&
            bytes[2] == 0xFF;
      }
      if (mimeType == "image/png") {
        return bytes.length >= 8 &&
            bytes[0] == 0x89 &&
            bytes[1] == 0x50 &&
            bytes[2] == 0x4E &&
            bytes[3] == 0x47;
      }
      if (mimeType == "image/webp") {
        return bytes.length >= 12 &&
            String.fromCharCodes(bytes.sublist(0, 4)) == "RIFF" &&
            String.fromCharCodes(bytes.sublist(8, 12)) == "WEBP";
      }
    }
    if (mimeType == "video/mp4" || mimeType == "audio/mp4") {
      return bytes.length >= 8 &&
          String.fromCharCodes(bytes.sublist(4, 8)) == "ftyp";
    }
    if (mimeType == "video/webm" || mimeType == "audio/webm") {
      return bytes.length >= 4 &&
          bytes[0] == 0x1A &&
          bytes[1] == 0x45 &&
          bytes[2] == 0xDF &&
          bytes[3] == 0xA3;
    }
    if (mimeType == "audio/mpeg") {
      return bytes.length >= 3 &&
          ((bytes[0] == 0x49 && bytes[1] == 0x44 && bytes[2] == 0x33) ||
              (bytes[0] == 0xFF && (bytes[1] & 0xE0) == 0xE0));
    }
    return true;
  }
}
