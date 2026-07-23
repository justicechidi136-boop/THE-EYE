import "../evidence/local_evidence_attachment.dart";
import "incident_media_reference.dart";

class MissingPersonDetails {
  const MissingPersonDetails({
    required this.fullName,
    this.age,
    this.gender,
    this.description,
    this.lastSeenAt,
    this.lastSeenAddress,
  });

  final String fullName;
  final int? age;
  final String? gender;
  final String? description;
  final String? lastSeenAt;
  final String? lastSeenAddress;

  Map<String, Object?> toJson() => {
        "fullName": fullName,
        if (age != null) "age": age,
        if (gender != null) "gender": gender,
        if (description != null) "description": description,
        if (lastSeenAt != null) "lastSeenAt": lastSeenAt,
        if (lastSeenAddress != null) "lastSeenAddress": lastSeenAddress,
      };

  factory MissingPersonDetails.fromJson(Map<String, dynamic> json) {
    return MissingPersonDetails(
      fullName: json["fullName"] as String,
      age: json["age"] as int?,
      gender: json["gender"] as String?,
      description: json["description"] as String?,
      lastSeenAt: json["lastSeenAt"] as String?,
      lastSeenAddress: json["lastSeenAddress"] as String?,
    );
  }
}

class StolenVehicleDetails {
  const StolenVehicleDetails({
    required this.plateNumber,
    required this.make,
    required this.model,
    this.vin,
    this.color,
    this.year,
    this.lastSeenAt,
    this.lastSeenArea,
  });

  final String plateNumber;
  final String make;
  final String model;
  final String? vin;
  final String? color;
  final int? year;
  final String? lastSeenAt;
  final String? lastSeenArea;

  Map<String, Object?> toJson() => {
        "plateNumber": plateNumber,
        "make": make,
        "model": model,
        if (vin != null) "vin": vin,
        if (color != null) "color": color,
        if (year != null) "year": year,
        if (lastSeenAt != null) "lastSeenAt": lastSeenAt,
        if (lastSeenArea != null) "lastSeenArea": lastSeenArea,
      };

  factory StolenVehicleDetails.fromJson(Map<String, dynamic> json) {
    return StolenVehicleDetails(
      plateNumber: json["plateNumber"] as String,
      make: json["make"] as String,
      model: json["model"] as String,
      vin: json["vin"] as String?,
      color: json["color"] as String?,
      year: json["year"] as int?,
      lastSeenAt: json["lastSeenAt"] as String?,
      lastSeenArea: json["lastSeenArea"] as String?,
    );
  }
}

class IncidentDraft {
  IncidentDraft({
    required this.clientSubmissionId,
    required this.type,
    required this.description,
    required this.latitude,
    required this.longitude,
    required this.capturedAt,
    this.locationAccuracyMeters,
    this.manualLatitude,
    this.manualLongitude,
    this.manualAddress,
    this.title,
    this.address,
    this.anonymous = true,
    this.notifyEmergencyContacts = false,
    this.emergencyContactIds = const [],
    this.media = const [],
    this.localMedia = const [],
    this.missingPerson,
    this.stolenVehicle,
    this.silent = false,
    this.emergencyCategory,
    this.locationMetadata = const {},
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now().toUtc();

  final String clientSubmissionId;
  final String type;
  final String description;
  final double latitude;
  final double longitude;
  final double? locationAccuracyMeters;
  final DateTime capturedAt;
  final double? manualLatitude;
  final double? manualLongitude;
  final String? manualAddress;
  final String? title;
  final String? address;
  final bool anonymous;
  final bool notifyEmergencyContacts;
  final List<String> emergencyContactIds;
  final List<IncidentMediaReference> media;
  final List<LocalEvidenceAttachment> localMedia;
  final MissingPersonDetails? missingPerson;
  final StolenVehicleDetails? stolenVehicle;
  final bool silent;
  final String? emergencyCategory;
  final Map<String, Object?> locationMetadata;
  final DateTime createdAt;

  Map<String, dynamic> toJson() => {
        "clientSubmissionId": clientSubmissionId,
        "type": type,
        "description": description,
        "latitude": latitude,
        "longitude": longitude,
        "locationAccuracyMeters": locationAccuracyMeters,
        "capturedAt": capturedAt.toUtc().toIso8601String(),
        "manualLatitude": manualLatitude,
        "manualLongitude": manualLongitude,
        "manualAddress": manualAddress,
        "title": title,
        "address": address,
        "anonymous": anonymous,
        "notifyEmergencyContacts": notifyEmergencyContacts,
        "emergencyContactIds": emergencyContactIds,
        "media": media.map((item) => item.toJson()).toList(),
        "localMedia": localMedia.map((item) => item.toJson()).toList(),
        "missingPerson": missingPerson?.toJson(),
        "stolenVehicle": stolenVehicle?.toJson(),
        "silent": silent,
        if (emergencyCategory != null && emergencyCategory!.isNotEmpty)
          "emergencyCategory": emergencyCategory,
        if (locationMetadata.isNotEmpty) "locationMetadata": locationMetadata,
        "createdAt": createdAt.toUtc().toIso8601String(),
      };

  factory IncidentDraft.fromJson(Map<String, dynamic> json) {
    return IncidentDraft(
      clientSubmissionId: json["clientSubmissionId"] as String,
      type: json["type"] as String,
      description: json["description"] as String,
      latitude: (json["latitude"] as num).toDouble(),
      longitude: (json["longitude"] as num).toDouble(),
      locationAccuracyMeters:
          (json["locationAccuracyMeters"] as num?)?.toDouble(),
      capturedAt: DateTime.parse(json["capturedAt"] as String),
      manualLatitude: (json["manualLatitude"] as num?)?.toDouble(),
      manualLongitude: (json["manualLongitude"] as num?)?.toDouble(),
      manualAddress: json["manualAddress"] as String?,
      title: json["title"] as String?,
      address: json["address"] as String?,
      anonymous: json["anonymous"] as bool? ?? true,
      notifyEmergencyContacts:
          json["notifyEmergencyContacts"] as bool? ?? false,
      emergencyContactIds:
          (json["emergencyContactIds"] as List<dynamic>? ?? const [])
              .map((item) => item as String)
              .toList(),
      media: (json["media"] as List<dynamic>? ?? const [])
          .map((item) => IncidentMediaReference.fromJson(
              Map<String, dynamic>.from(item as Map)))
          .toList(),
      localMedia: (json["localMedia"] as List<dynamic>? ?? const [])
          .map((item) => LocalEvidenceAttachment.fromJson(
              Map<String, dynamic>.from(item as Map)))
          .toList(),
      missingPerson: json["missingPerson"] == null
          ? null
          : MissingPersonDetails.fromJson(
              Map<String, dynamic>.from(json["missingPerson"] as Map)),
      stolenVehicle: json["stolenVehicle"] == null
          ? null
          : StolenVehicleDetails.fromJson(
              Map<String, dynamic>.from(json["stolenVehicle"] as Map)),
      silent: json["silent"] as bool? ?? false,
      emergencyCategory: json["emergencyCategory"] as String?,
      locationMetadata: Map<String, Object?>.from(
        json["locationMetadata"] as Map? ?? const {},
      ),
      createdAt: DateTime.parse(json["createdAt"] as String),
    );
  }
}
