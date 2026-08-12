import "../contracts/the_eye_enums.dart";
import "evidence_constants.dart";
import "local_evidence_attachment.dart";

class EvidencePolicy {
  const EvidencePolicy({
    required this.maxPhotos,
    required this.maxVideos,
    required this.maxAudio,
    required this.maxFiles,
    required this.maxFileSize,
    required this.maxTotalBytes,
    required this.supportedMimeTypes,
  });

  final int maxPhotos;
  final int maxVideos;
  final int maxAudio;
  final int maxFiles;
  final int maxFileSize;
  final int maxTotalBytes;
  final Set<String> supportedMimeTypes;

  static const incident = EvidencePolicy(
    maxPhotos: 6,
    maxVideos: 2,
    maxAudio: 2,
    maxFiles: EvidenceLimits.maxAttachments,
    maxFileSize: EvidenceLimits.maxFileBytes,
    maxTotalBytes: 300 * 1024 * 1024,
    supportedMimeTypes: EvidenceMimeTypes.allowed,
  );

  static const vehiclePhotos = EvidencePolicy(
    maxPhotos: 8,
    maxVideos: 0,
    maxAudio: 0,
    maxFiles: 8,
    maxFileSize: 5 * 1024 * 1024,
    maxTotalBytes: 8 * 5 * 1024 * 1024,
    supportedMimeTypes: EvidenceMimeTypes.image,
  );

  int maxForMediaType(String mediaType) {
    return switch (mediaType) {
      IncidentMediaType.image => maxPhotos,
      IncidentMediaType.video => maxVideos,
      IncidentMediaType.audio => maxAudio,
      _ => maxFiles,
    };
  }

  String labelForMediaType(String mediaType) {
    return switch (mediaType) {
      IncidentMediaType.image => "Photos",
      IncidentMediaType.video => "Videos",
      IncidentMediaType.audio => "Audio",
      _ => "Files",
    };
  }

  int countForMediaType(
    Iterable<LocalEvidenceAttachment> attachments,
    String mediaType,
  ) {
    return attachments.where((item) => item.mediaType == mediaType).length;
  }

  int totalBytes(Iterable<LocalEvidenceAttachment> attachments) {
    return attachments.fold<int>(
      0,
      (sum, item) => sum + item.sizeBytes,
    );
  }

  bool canAddMediaType(
    Iterable<LocalEvidenceAttachment> attachments,
    String mediaType,
  ) {
    if (attachments.length >= maxFiles) return false;
    if (countForMediaType(attachments, mediaType) >=
        maxForMediaType(mediaType)) {
      return false;
    }
    return true;
  }

  String capacityLabel({
    required String mediaType,
    required int usedCount,
  }) {
    return "${labelForMediaType(mediaType)} $usedCount of ${maxForMediaType(mediaType)}";
  }

  String filesCapacityLabel(int usedCount) {
    return "Files $usedCount of $maxFiles";
  }

  String? limitMessageForCapture({
    required Iterable<LocalEvidenceAttachment> attachments,
    required String mediaType,
  }) {
    if (attachments.length >= maxFiles) {
      return "Evidence limit reached. ${filesCapacityLabel(attachments.length)}.";
    }
    final kindCount = countForMediaType(attachments, mediaType);
    final kindMax = maxForMediaType(mediaType);
    if (kindCount >= kindMax) {
      return "Evidence limit reached. ${capacityLabel(mediaType: mediaType, usedCount: kindCount)}.";
    }
    return null;
  }

  String? limitMessageForAttachment({
    required Iterable<LocalEvidenceAttachment> existing,
    required LocalEvidenceAttachment incoming,
  }) {
    if (incoming.sizeBytes <= 0 || incoming.sizeBytes > maxFileSize) {
      return "Evidence must be between 1 byte and ${maxFileSize ~/ (1024 * 1024)} MB.";
    }
    if (!supportedMimeTypes.contains(incoming.contentType)) {
      return "Unsupported evidence file type.";
    }
    final bytesUsed = totalBytes(existing);
    if (bytesUsed + incoming.sizeBytes > maxTotalBytes) {
      final usedMb = ((bytesUsed + incoming.sizeBytes) / (1024 * 1024)).round();
      final maxMb = (maxTotalBytes / (1024 * 1024)).round();
      return "Evidence storage limit reached ($usedMb MB of $maxMb MB).";
    }
    return limitMessageForCapture(
      attachments: existing,
      mediaType: incoming.mediaType,
    );
  }
}

typedef EvidenceLimitsPolicy = EvidencePolicy;
