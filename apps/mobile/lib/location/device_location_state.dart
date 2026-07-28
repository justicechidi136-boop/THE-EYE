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
