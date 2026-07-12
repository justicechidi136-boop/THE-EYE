import "dart:convert";

class CarProfile {
  const CarProfile({
    required this.make,
    required this.model,
    required this.plateNumber,
    this.year,
    this.color,
    this.vin,
    this.notes,
    this.imagePath,
  });

  final String make;
  final String model;
  final String plateNumber;
  final int? year;
  final String? color;
  final String? vin;
  final String? notes;
  final String? imagePath;

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
        "make": make,
        "model": model,
        "plateNumber": plateNumber,
        if (year != null) "year": year,
        if (color != null && color!.isNotEmpty) "color": color,
        if (vin != null && vin!.isNotEmpty) "vin": vin,
        if (notes != null && notes!.isNotEmpty) "notes": notes,
        if (imagePath != null && imagePath!.isNotEmpty) "imagePath": imagePath,
      };

  factory CarProfile.fromJson(Map<String, dynamic> json) {
    return CarProfile(
      make: json["make"] as String? ?? "",
      model: json["model"] as String? ?? "",
      plateNumber: json["plateNumber"] as String? ?? "",
      year: json["year"] as int?,
      color: json["color"] as String?,
      vin: json["vin"] as String?,
      notes: json["notes"] as String?,
      imagePath: json["imagePath"] as String?,
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
  }) {
    return CarProfile(
      make: make ?? this.make,
      model: model ?? this.model,
      plateNumber: plateNumber ?? this.plateNumber,
      year: clearYear ? null : (year ?? this.year),
      color: color ?? this.color,
      vin: vin ?? this.vin,
      notes: notes ?? this.notes,
      imagePath: clearImagePath ? null : (imagePath ?? this.imagePath),
    );
  }
}
