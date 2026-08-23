import "../contracts/the_eye_enums.dart";
import "local_evidence_attachment.dart";

enum EvidenceItemKind { photo, video, audio, other }

typedef AuthorizedEvidenceUriLoader = Future<Uri> Function();

class EvidenceItem {
  const EvidenceItem({
    required this.id,
    required this.mediaType,
    required this.label,
    this.createdAt,
    this.durationSeconds,
    this.localPath,
    this.authorizedUri,
    this.loadAuthorizedUri,
  });

  final String id;
  final String mediaType;
  final String label;
  final DateTime? createdAt;
  final int? durationSeconds;
  final String? localPath;
  final Uri? authorizedUri;
  final AuthorizedEvidenceUriLoader? loadAuthorizedUri;

  EvidenceItemKind get kind {
    final normalized = mediaType.toLowerCase();
    if (normalized == IncidentMediaType.image || normalized.contains("image")) {
      return EvidenceItemKind.photo;
    }
    if (normalized == IncidentMediaType.video || normalized.contains("video")) {
      return EvidenceItemKind.video;
    }
    if (normalized == IncidentMediaType.audio ||
        normalized.contains("audio") ||
        normalized.contains("voice")) {
      return EvidenceItemKind.audio;
    }
    return EvidenceItemKind.other;
  }

  Future<Uri> resolveUri() async {
    final path = localPath?.trim();
    if (path != null && path.isNotEmpty) return Uri.file(path);
    final direct = authorizedUri;
    if (direct != null) return _validateRemoteUri(direct);
    final loader = loadAuthorizedUri;
    if (loader == null) throw const EvidenceUnavailableException();
    return _validateRemoteUri(await loader());
  }

  static Uri _validateRemoteUri(Uri uri) {
    if (uri.scheme != "https") throw const EvidenceUnavailableException();
    return uri;
  }

  static EvidenceItem fromLocal(
    LocalEvidenceAttachment attachment, {
    required String label,
  }) {
    return EvidenceItem(
      id: attachment.localId,
      mediaType: attachment.mediaType,
      label: label,
      createdAt: attachment.capturedAt,
      durationSeconds: attachment.durationSeconds,
      localPath: attachment.uploadPath,
    );
  }
}

class EvidenceUnavailableException implements Exception {
  const EvidenceUnavailableException();
}

String formatEvidenceDuration(int seconds) {
  final minutes = (seconds ~/ 60).toString().padLeft(2, "0");
  final remainder = (seconds % 60).toString().padLeft(2, "0");
  return "$minutes:$remainder";
}
