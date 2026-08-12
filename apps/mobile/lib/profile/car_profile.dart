import "dart:convert";

class CarPhotoRef {
  const CarPhotoRef({
    this.id,
    this.objectKey,
    this.contentType,
    this.sizeBytes,
    this.sortOrder = 0,
    this.createdAt,
    this.previewUrl,
  });

  final String? id;
  final String? objectKey;
  final String? contentType;
  final int? sizeBytes;
  final int sortOrder;
  final DateTime? createdAt;
  final String? previewUrl;

  Map<String, Object?> toJson() => {
        if (id != null && id!.isNotEmpty) "id": id,
        if (objectKey != null && objectKey!.isNotEmpty) "objectKey": objectKey,
        if (contentType != null && contentType!.isNotEmpty) "contentType": contentType,
        if (sizeBytes != null) "sizeBytes": sizeBytes,
        "sortOrder": sortOrder,
        if (createdAt != null) "createdAt": createdAt!.toUtc().toIso8601String(),
        if (previewUrl != null && previewUrl!.isNotEmpty) "previewUrl": previewUrl,
      };

  factory CarPhotoRef.fromJson(Map<String, dynamic> json) {
    return CarPhotoRef(
      id: json["id"] as String?,
      objectKey: json["objectKey"] as String?,
      contentType: json["contentType"] as String?,
      sizeBytes: (json["sizeBytes"] as num?)?.toInt(),
      sortOrder: (json["sortOrder"] as num?)?.toInt() ?? 0,
      createdAt: DateTime.tryParse((json["createdAt"] as String?) ?? ""),
      previewUrl:
          (json["signedGetUrl"] as String?) ?? (json["previewUrl"] as String?),
    );
  }
}

class CarProfile {
  const CarProfile({
    this.id,
    required this.make,
    required this.model,
    required this.plateNumber,
    this.year,
    this.color,
    this.vin,
    this.notes,
    this.imagePath,
    this.photos = const [],
    this.isPrimary = false,
    this.createdAt,
    this.updatedAt,
  });

  final String? id;
  final String make;
  final String model;
  final String plateNumber;
  final int? year;
  final String? color;
  final String? vin;
  final String? notes;
  final String? imagePath;
  final List<CarPhotoRef> photos;
  final bool isPrimary;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  bool get hasRequiredFields =>
      make.trim().isNotEmpty &&
      model.trim().isNotEmpty &&
      plateNumber.trim().isNotEmpty;

  String get displayLabel {
    final parts = <String>[
      if (year != null) year.toString(),
      make.trim(),
      model.trim(),
    ];
    return parts.where((part) => part.isNotEmpty).join(" ");
  }

  Map<String, Object?> toJson() => {
        if (id != null && id!.isNotEmpty) "id": id,
        "make": make,
        "model": model,
        "plateNumber": plateNumber,
        if (year != null) "year": year,
        if (color != null && color!.isNotEmpty) "color": color,
        if (vin != null && vin!.isNotEmpty) "vin": vin,
        if (notes != null && notes!.isNotEmpty) "notes": notes,
        if (imagePath != null && imagePath!.isNotEmpty) "imagePath": imagePath,
        if (photos.isNotEmpty) "photos": photos.map((photo) => photo.toJson()).toList(growable: false),
        "isPrimary": isPrimary,
        if (createdAt != null)
          "createdAt": createdAt!.toUtc().toIso8601String(),
        if (updatedAt != null)
          "updatedAt": updatedAt!.toUtc().toIso8601String(),
      };

  factory CarProfile.fromJson(Map<String, dynamic> json) {
    return CarProfile(
      id: json["id"] as String?,
      make: json["make"] as String? ?? "",
      model: json["model"] as String? ?? "",
      plateNumber: json["plateNumber"] as String? ?? "",
      year: json["year"] as int?,
      color: json["color"] as String?,
      vin: json["vin"] as String?,
      notes: json["notes"] as String?,
      imagePath: json["imagePath"] as String?,
      photos: (json["photos"] is List)
          ? (json["photos"] as List)
              .whereType<Map>()
              .map((item) => CarPhotoRef.fromJson(Map<String, dynamic>.from(item)))
              .toList(growable: false)
          : const [],
      isPrimary: json["isPrimary"] == true,
      createdAt: DateTime.tryParse((json["createdAt"] as String?) ?? ""),
      updatedAt: DateTime.tryParse((json["updatedAt"] as String?) ?? ""),
    );
  }

  String toStorageJson() => jsonEncode(toJson());

  static CarProfile? fromStorageJson(String? raw) {
    if (raw == null || raw.trim().isEmpty) return null;
    final decoded = jsonDecode(raw);
    if (decoded is! Map) return null;
    return CarProfile.fromJson(Map<String, dynamic>.from(decoded));
  }

  CarProfile copyWith({
    String? id,
    String? make,
    String? model,
    String? plateNumber,
    int? year,
    bool clearYear = false,
    String? color,
    String? vin,
    String? notes,
    String? imagePath,
    bool clearImagePath = false,
    List<CarPhotoRef>? photos,
    bool? isPrimary,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return CarProfile(
      id: id ?? this.id,
      make: make ?? this.make,
      model: model ?? this.model,
      plateNumber: plateNumber ?? this.plateNumber,
      year: clearYear ? null : (year ?? this.year),
      color: color ?? this.color,
      vin: vin ?? this.vin,
      notes: notes ?? this.notes,
      imagePath: clearImagePath ? null : (imagePath ?? this.imagePath),
      photos: photos ?? this.photos,
      isPrimary: isPrimary ?? this.isPrimary,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
