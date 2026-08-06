class IncidentMediaReference {
  const IncidentMediaReference({
    this.id,
    required this.mediaType,
    required this.bucket,
    required this.objectKey,
    required this.contentType,
    required this.fileHash,
    this.sizeBytes,
    this.capturedAt,
    this.latitude,
    this.longitude,
    this.metadata,
    this.durationSeconds,
    this.selectedLanguage,
    this.clientAttachmentId,
  });

  final String? id;
  final String mediaType;
  final String bucket;
  final String objectKey;
  final String contentType;
  final String fileHash;
  final int? sizeBytes;
  final String? capturedAt;
  final double? latitude;
  final double? longitude;
  final Map<String, Object?>? metadata;
  final int? durationSeconds;
  final String? selectedLanguage;
  final String? clientAttachmentId;

  Map<String, Object?> toJson() => {
        "mediaType": mediaType,
        "bucket": bucket,
        "objectKey": objectKey,
        "contentType": contentType,
        "fileHash": fileHash,
        if (sizeBytes != null) "sizeBytes": sizeBytes,
        if (capturedAt != null) "capturedAt": capturedAt,
        if (latitude != null) "latitude": latitude,
        if (longitude != null) "longitude": longitude,
        if (metadata != null) "metadata": metadata,
        if (durationSeconds != null) "durationSeconds": durationSeconds,
        if (selectedLanguage != null) "selectedLanguage": selectedLanguage,
        if (clientAttachmentId != null) "clientAttachmentId": clientAttachmentId,
      };

  factory IncidentMediaReference.fromJson(Map<String, dynamic> json) {
    return IncidentMediaReference(
      id: json["id"]?.toString(),
      mediaType: json["mediaType"] as String,
      bucket: json["bucket"] as String,
      objectKey: json["objectKey"] as String,
      contentType: json["contentType"] as String,
      fileHash: json["fileHash"] as String,
      sizeBytes: json["sizeBytes"] as int?,
      capturedAt: json["capturedAt"] as String?,
      latitude: (json["latitude"] as num?)?.toDouble(),
      longitude: (json["longitude"] as num?)?.toDouble(),
      metadata: json["metadata"] == null
          ? null
          : Map<String, Object?>.from(json["metadata"] as Map),
    );
  }
}
