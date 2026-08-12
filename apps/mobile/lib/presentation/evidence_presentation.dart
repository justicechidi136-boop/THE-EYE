import "../contracts/the_eye_enums.dart";
import "../evidence/local_evidence_attachment.dart";
import "citizen_date_time.dart";

enum EvidenceMediaKind { photo, video, audio, document }

enum EvidenceDisplayState {
  ready,
  uploading,
  uploaded,
  failed,
}

class EvidencePresentation {
  const EvidencePresentation({
    required this.id,
    required this.displayName,
    required this.mediaKind,
    required this.displayTimestamp,
    required this.state,
    required this.semanticsLabel,
    this.thumbnailPath,
    this.durationSeconds,
    this.statusLine,
    this.canView = true,
    this.canRetry = false,
    this.canRemove = true,
    this.canPlay = false,
  });

  final String id;
  final String displayName;
  final EvidenceMediaKind mediaKind;
  final String displayTimestamp;
  final EvidenceDisplayState state;
  final String semanticsLabel;
  final String? thumbnailPath;
  final int? durationSeconds;
  final String? statusLine;
  final bool canView;
  final bool canRetry;
  final bool canRemove;
  final bool canPlay;
}

abstract final class EvidencePresentationMapper {
  static EvidenceMediaKind kindForMediaType(String mediaType) {
    if (mediaType == IncidentMediaType.image) return EvidenceMediaKind.photo;
    if (mediaType == IncidentMediaType.video) return EvidenceMediaKind.video;
    if (mediaType == IncidentMediaType.audio) return EvidenceMediaKind.audio;
    return EvidenceMediaKind.document;
  }

  static String _prefix(EvidenceMediaKind kind) => switch (kind) {
        EvidenceMediaKind.photo => "Photo",
        EvidenceMediaKind.video => "Video",
        EvidenceMediaKind.audio => "Audio",
        EvidenceMediaKind.document => "Document",
      };

  static String _clock(int seconds) {
    final m = (seconds ~/ 60).toString().padLeft(2, "0");
    final s = (seconds % 60).toString().padLeft(2, "0");
    return "$m:$s";
  }

  /// Deterministic per-type numbering: Photo 1, Photo 2, Video 1, …
  static List<EvidencePresentation> mapLocalAttachments(
    List<LocalEvidenceAttachment> attachments, {
    DateTime? now,
  }) {
    final counters = <EvidenceMediaKind, int>{};
    return [
      for (final attachment in attachments)
        mapLocalAttachment(
          attachment,
          indexWithinKind: (counters[kindForMediaType(attachment.mediaType)] =
              (counters[kindForMediaType(attachment.mediaType)] ?? 0) + 1),
          now: now,
        ),
    ];
  }

  static EvidencePresentation mapLocalAttachment(
    LocalEvidenceAttachment attachment, {
    required int indexWithinKind,
    DateTime? now,
  }) {
    final kind = kindForMediaType(attachment.mediaType);
    final duration = attachment.durationSeconds;
    final durationSuffix = (kind == EvidenceMediaKind.video ||
            kind == EvidenceMediaKind.audio) &&
        duration != null
        ? " · ${_clock(duration)}"
        : "";
    final displayName = "${_prefix(kind)} $indexWithinKind$durationSuffix";
    final state = switch (attachment.state) {
      LocalEvidenceState.captured => EvidenceDisplayState.ready,
      LocalEvidenceState.uploading => EvidenceDisplayState.uploading,
      LocalEvidenceState.uploaded => EvidenceDisplayState.uploaded,
      LocalEvidenceState.failed => EvidenceDisplayState.failed,
    };
    final statusLine = switch (state) {
      EvidenceDisplayState.ready => "Ready to upload",
      EvidenceDisplayState.uploading =>
        "Uploading ${(attachment.uploadProgress * 100).round()}%",
      EvidenceDisplayState.uploaded =>
        "Uploaded ${CitizenDateTimeFormatter.formatReportedAt(attachment.capturedAt, now: now)}",
      EvidenceDisplayState.failed => "Upload failed",
    };
    final durationLabel = duration == null
        ? null
        : duration >= 60
            ? "${duration ~/ 60}m ${duration % 60}s"
            : "$duration seconds";
    final semantics = [
      displayName,
      if (state == EvidenceDisplayState.uploaded) "uploaded successfully",
      if (state == EvidenceDisplayState.failed)
        "upload failed. Retry available",
      if (state == EvidenceDisplayState.uploading) "uploading",
      if (durationLabel != null) durationLabel,
    ].join(", ");

    return EvidencePresentation(
      id: attachment.localId,
      displayName: displayName,
      mediaKind: kind,
      displayTimestamp: CitizenDateTimeFormatter.formatReportedAt(
        attachment.capturedAt,
        now: now,
      ),
      state: state,
      semanticsLabel: semantics,
      thumbnailPath: attachment.isImage ? attachment.uploadPath : null,
      durationSeconds: duration,
      statusLine: statusLine,
      canView: attachment.isImage || attachment.isVideo,
      canPlay: attachment.isAudio || attachment.isVideo,
      canRetry: state == EvidenceDisplayState.failed,
      canRemove: true,
    );
  }

  /// For remote/server evidence rows without local files.
  static List<EvidencePresentation> mapRemoteItems(
    List<({String id, String mediaType, DateTime? createdAt})> items, {
    DateTime? now,
  }) {
    final counters = <EvidenceMediaKind, int>{};
    return [
      for (final item in items)
        () {
          final kind = kindForMediaType(item.mediaType);
          final index = counters[kind] = (counters[kind] ?? 0) + 1;
          final displayName = "${_prefix(kind)} $index";
          final stamped = item.createdAt;
          return EvidencePresentation(
            id: item.id,
            displayName: displayName,
            mediaKind: kind,
            displayTimestamp: stamped == null
                ? "Time unavailable"
                : CitizenDateTimeFormatter.formatReportedAt(stamped, now: now),
            state: EvidenceDisplayState.uploaded,
            semanticsLabel: "$displayName, uploaded successfully",
            statusLine: stamped == null
                ? "Uploaded"
                : "Uploaded ${CitizenDateTimeFormatter.formatReportedAt(stamped, now: now)}",
            canView: kind == EvidenceMediaKind.photo ||
                kind == EvidenceMediaKind.video,
            canPlay: kind == EvidenceMediaKind.audio ||
                kind == EvidenceMediaKind.video,
            canRetry: false,
            canRemove: false,
          );
        }(),
    ];
  }
}
