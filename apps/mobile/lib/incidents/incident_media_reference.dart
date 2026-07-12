class IncidentMediaReference {
  const IncidentMediaReference({
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
  });

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
      };

  factory IncidentMediaReference.fromJson(Map<String, dynamic> json) {
    return IncidentMediaReference(
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
