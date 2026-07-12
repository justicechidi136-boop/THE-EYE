import "../contracts/the_eye_enums.dart";

enum LocalEvidenceState {
  captured,
  uploading,
  uploaded,
  failed,
}

class LocalEvidenceAttachment {
  const LocalEvidenceAttachment({
    required this.localId,
    required this.mediaType,
    required this.fileName,
    required this.originalPath,
    required this.uploadPath,
    required this.contentType,
    required this.fileHash,
    required this.originalFileHash,
    required this.sizeBytes,
    required this.capturedAt,
    this.latitude,
    this.longitude,
    this.durationSeconds,
    this.state = LocalEvidenceState.captured,
    this.uploadProgress = 0,
    this.errorMessage,
    this.metadata = const {},
  });

  final String localId;
  final String mediaType;
  final String fileName;
  final String originalPath;
  final String uploadPath;
  final String contentType;
  final String fileHash;
  final String originalFileHash;
  final int sizeBytes;
  final DateTime capturedAt;
  final double? latitude;
  final double? longitude;
  final int? durationSeconds;
  final LocalEvidenceState state;
  final double uploadProgress;
  final String? errorMessage;
  final Map<String, Object?> metadata;

  bool get isImage => mediaType == IncidentMediaType.image;
  bool get isVideo => mediaType == IncidentMediaType.video;
  bool get isAudio => mediaType == IncidentMediaType.audio;

  LocalEvidenceAttachment copyWith({
    LocalEvidenceState? state,
    double? uploadProgress,
    String? errorMessage,
    String? uploadPath,
    String? fileHash,
    int? sizeBytes,
    Map<String, Object?>? metadata,
  }) {
    return LocalEvidenceAttachment(
      localId: localId,
      mediaType: mediaType,
      fileName: fileName,
      originalPath: originalPath,
      uploadPath: uploadPath ?? this.uploadPath,
      contentType: contentType,
      fileHash: fileHash ?? this.fileHash,
      originalFileHash: originalFileHash,
      sizeBytes: sizeBytes ?? this.sizeBytes,
      capturedAt: capturedAt,
      latitude: latitude,
      longitude: longitude,
      durationSeconds: durationSeconds,
      state: state ?? this.state,
      uploadProgress: uploadProgress ?? this.uploadProgress,
      errorMessage: errorMessage,
      metadata: metadata ?? this.metadata,
    );
  }

  Map<String, Object?> toJson() => {
        "localId": localId,
        "mediaType": mediaType,
        "fileName": fileName,
        "originalPath": originalPath,
        "uploadPath": uploadPath,
        "contentType": contentType,
        "fileHash": fileHash,
        "originalFileHash": originalFileHash,
        "sizeBytes": sizeBytes,
        "capturedAt": capturedAt.toUtc().toIso8601String(),
        if (latitude != null) "latitude": latitude,
        if (longitude != null) "longitude": longitude,
        if (durationSeconds != null) "durationSeconds": durationSeconds,
        "state": state.name,
        "uploadProgress": uploadProgress,
        if (errorMessage != null) "errorMessage": errorMessage,
        "metadata": metadata,
      };

  factory LocalEvidenceAttachment.fromJson(Map<String, dynamic> json) {
    return LocalEvidenceAttachment(
      localId: json["localId"] as String,
      mediaType: json["mediaType"] as String,
      fileName: json["fileName"] as String,
      originalPath: json["originalPath"] as String,
      uploadPath: json["uploadPath"] as String,
      contentType: json["contentType"] as String,
      fileHash: json["fileHash"] as String,
      originalFileHash:
          json["originalFileHash"] as String? ?? json["fileHash"] as String,
      sizeBytes: json["sizeBytes"] as int,
      capturedAt: DateTime.parse(json["capturedAt"] as String),
      latitude: (json["latitude"] as num?)?.toDouble(),
      longitude: (json["longitude"] as num?)?.toDouble(),
      durationSeconds: json["durationSeconds"] as int?,
      state: LocalEvidenceState.values
          .byName(json["state"] as String? ?? "captured"),
      uploadProgress: (json["uploadProgress"] as num?)?.toDouble() ?? 0,
      errorMessage: json["errorMessage"] as String?,
      metadata: Map<String, Object?>.from(json["metadata"] as Map? ?? const {}),
    );
  }
}
