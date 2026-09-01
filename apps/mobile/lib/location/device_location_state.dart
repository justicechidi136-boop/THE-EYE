import "emergency_location_fix.dart";
import "location_types.dart";

/// Factual device location display state — never conflates GPS with profile jurisdiction.
enum DeviceLocationStatus {
  idle,
  checkingPermission,
  requestingPermission,
  checkingService,
  acquiring,
  acquired,
  cached,
  denied,
  permanentlyDenied,
  serviceDisabled,
  timedOut,
  unavailable,
  failed,
}

enum DeviceLocationSourceKind {
  freshGps,
  networkLocation,
  cachedDevice,
  profileJurisdiction,
  manualSelection,
  backendJurisdictionFallback,
  unavailable,
}

class DeviceLocationState {
  const DeviceLocationState({
    required this.status,
    this.latitude,
    this.longitude,
    this.accuracyMeters,
    this.capturedAt,
    this.ageSeconds,
    this.source = DeviceLocationSourceKind.unavailable,
    this.quality,
    this.locality,
    this.street,
    this.subLocality,
    this.lga,
    this.state,
    this.country,
    this.isCached = false,
    this.isProfileFallback = false,
    this.isJurisdictionFallback = false,
    this.permissionState,
    this.serviceEnabled,
    this.errorCode,
    this.message,
    this.requestId,
  });

  final DeviceLocationStatus status;
  final double? latitude;
  final double? longitude;
  final double? accuracyMeters;
  final DateTime? capturedAt;
  final int? ageSeconds;
  final DeviceLocationSourceKind source;
  final EmergencyLocationQuality? quality;
  final String? locality;
  final String? street;
  final String? subLocality;
  final String? lga;
  final String? state;
  final String? country;
  final bool isCached;
  final bool isProfileFallback;
  final bool isJurisdictionFallback;
  final LocationPermissionState? permissionState;
  final bool? serviceEnabled;
  final String? errorCode;
  final String? message;
  final String? requestId;

  bool get hasCoordinates =>
      latitude != null &&
      longitude != null &&
      latitude!.abs() > 0.000001 &&
      longitude!.abs() > 0.000001;

  bool get isAcquired =>
      status == DeviceLocationStatus.acquired ||
      status == DeviceLocationStatus.cached;

  String get headlineLabel {
    if (isProfileFallback || isJurisdictionFallback) {
      return "Profile jurisdiction";
    }
    if (isCached) {
      return "Last known device location";
    }
    if (isAcquired) {
      return "Current device location";
    }
    return "Device location";
  }

  String get displayLocality {
    final parts = <String>[
      if (locality != null && locality!.trim().isNotEmpty) locality!.trim(),
      if (state != null && state!.trim().isNotEmpty) state!.trim(),
    ];
    if (parts.isNotEmpty) return parts.join(", ");
    if (hasCoordinates) return "Location acquired (address unavailable)";
    if (status == DeviceLocationStatus.unavailable ||
        status == DeviceLocationStatus.failed ||
        status == DeviceLocationStatus.timedOut) {
      return "Current device location is unavailable.";
    }
    return message ?? "Current device location is unavailable.";
  }

  /// Public, privacy-reduced place label for nearby danger recipients.
  /// Building numbers, plus codes, exact coordinates, and reporter identity
  /// are intentionally excluded.
  String get dangerPublicArea {
    final parts = <String>[];
    final road = _publicRoadName(street);
    final neighborhood = _publicPlaceName(subLocality);
    final city = _publicPlaceName(locality) ?? _publicPlaceName(lga);
    final region = _publicPlaceName(state);
    for (final value in [road, neighborhood, city, region]) {
      if (value == null ||
          parts.any((part) => part.toLowerCase() == value.toLowerCase())) {
        continue;
      }
      parts.add(value);
    }
    return parts.isEmpty ? "Nearby area" : parts.join(", ");
  }

  /// Precise label for spoken danger warnings. City and state are excluded
  /// because they are too broad to identify a nearby danger location.
  String get dangerSpokenLocation {
    final streetName = _publicRoadName(street);
    if (streetName != null) return streetName;

    final nearbyLandmark = subLocality?.trim();
    if (nearbyLandmark != null &&
        nearbyLandmark.isNotEmpty &&
        !_sameLabel(nearbyLandmark, locality) &&
        !_sameLabel(nearbyLandmark, lga) &&
        !_sameLabel(nearbyLandmark, state)) {
      return nearbyLandmark;
    }
    return "the reported location";
  }

  bool _sameLabel(String value, String? other) =>
      other != null && value.toLowerCase() == other.trim().toLowerCase();

  String? _publicRoadName(String? value) {
    final normalized = _publicPlaceName(value);
    if (normalized == null) return null;
    final withoutBuildingNumber = normalized.replaceFirst(
      RegExp(r"^\d+[A-Za-z]?(?:\s*[-/]\s*\d+[A-Za-z]?)?[,\s]+"),
      "",
    );
    return withoutBuildingNumber.isEmpty ? null : withoutBuildingNumber;
  }

  String? _publicPlaceName(String? value) {
    final normalized = value?.trim().replaceAll(RegExp(r"\s+"), " ");
    if (normalized == null || normalized.isEmpty) return null;
    if (RegExp(
      r"(?:^|\s)[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,}(?:\s|$)",
      caseSensitive: false,
    ).hasMatch(normalized)) {
      return null;
    }
    return normalized;
  }

  String get sourceLabel {
    switch (source) {
      case DeviceLocationSourceKind.freshGps:
        return "Fresh GPS";
      case DeviceLocationSourceKind.networkLocation:
        return "Network location";
      case DeviceLocationSourceKind.cachedDevice:
        return "Cached device location";
      case DeviceLocationSourceKind.profileJurisdiction:
        return "Saved profile jurisdiction";
      case DeviceLocationSourceKind.manualSelection:
        return "Manual selection";
      case DeviceLocationSourceKind.backendJurisdictionFallback:
        return "Backend jurisdiction fallback";
      case DeviceLocationSourceKind.unavailable:
        return "Unavailable";
    }
  }

  String get ageLabel {
    if (capturedAt == null) return "";
    final age = ageSeconds ?? DateTime.now().difference(capturedAt!).inSeconds;
    if (age <= 5) return "Just now";
    if (age < 60) return "$age seconds ago";
    if (age < 3600) return "${age ~/ 60} minutes ago";
    return "${age ~/ 3600} hours ago";
  }

  String get accuracyLabel {
    if (accuracyMeters == null) return "Unknown";
    return "Approximately ${accuracyMeters!.round()} metres";
  }

  DeviceLocationState copyWith({
    DeviceLocationStatus? status,
    double? latitude,
    double? longitude,
    double? accuracyMeters,
    DateTime? capturedAt,
    int? ageSeconds,
    DeviceLocationSourceKind? source,
    EmergencyLocationQuality? quality,
    String? locality,
    String? street,
    String? subLocality,
    String? lga,
    String? state,
    String? country,
    bool? isCached,
    bool? isProfileFallback,
    bool? isJurisdictionFallback,
    LocationPermissionState? permissionState,
    bool? serviceEnabled,
    String? errorCode,
    String? message,
    String? requestId,
  }) {
    return DeviceLocationState(
      status: status ?? this.status,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      accuracyMeters: accuracyMeters ?? this.accuracyMeters,
      capturedAt: capturedAt ?? this.capturedAt,
      ageSeconds: ageSeconds ?? this.ageSeconds,
      source: source ?? this.source,
      quality: quality ?? this.quality,
      locality: locality ?? this.locality,
      street: street ?? this.street,
      subLocality: subLocality ?? this.subLocality,
      lga: lga ?? this.lga,
      state: state ?? this.state,
      country: country ?? this.country,
      isCached: isCached ?? this.isCached,
      isProfileFallback: isProfileFallback ?? this.isProfileFallback,
      isJurisdictionFallback:
          isJurisdictionFallback ?? this.isJurisdictionFallback,
      permissionState: permissionState ?? this.permissionState,
      serviceEnabled: serviceEnabled ?? this.serviceEnabled,
      errorCode: errorCode ?? this.errorCode,
      message: message ?? this.message,
      requestId: requestId ?? this.requestId,
    );
  }
}

class ProfileJurisdictionDisplay {
  const ProfileJurisdictionDisplay({
    this.country,
    this.state,
    this.lga,
    this.complete = false,
  });

  final String? country;
  final String? state;
  final String? lga;
  final bool complete;

  bool get hasValues =>
      (country?.trim().isNotEmpty ?? false) ||
      (state?.trim().isNotEmpty ?? false) ||
      (lga?.trim().isNotEmpty ?? false);

  String get label {
    final parts = <String>[
      if (lga != null && lga!.trim().isNotEmpty) lga!.trim(),
      if (state != null && state!.trim().isNotEmpty) state!.trim(),
      if (country != null && country!.trim().isNotEmpty) country!.trim(),
    ];
    return parts.isEmpty ? "Not set" : parts.join(", ");
  }
}

String maskCoordinate(double value) {
  final rounded = (value * 100).round() / 100;
  return rounded.toStringAsFixed(2);
}
