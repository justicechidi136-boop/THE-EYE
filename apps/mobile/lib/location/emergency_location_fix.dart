import "package:geolocator/geolocator.dart";

import "location_types.dart";

/// Stable location error codes for diagnostics (no coordinates in logs).
abstract final class LocationErrorCode {
  static const permissionDenied = "LOC-001";
  static const permanentlyDenied = "LOC-002";
  static const serviceDisabled = "LOC-003";
  static const acquisitionTimeout = "LOC-004";
  static const staleCachedFix = "LOC-005";
  static const invalidFix = "LOC-006";
  static const trackerUnavailable = "LOC-007";
  static const backgroundServiceBlocked = "LOC-008";
}

/// Stable error codes for Settings → Test current location (no coordinates in logs).
abstract final class LocationTestErrorCode {
  static const permissionDenied = "LOC-TEST-001";
  static const permanentlyDenied = "LOC-TEST-002";
  static const serviceDisabled = "LOC-TEST-003";
  static const acquisitionTimeout = "LOC-TEST-004";
  static const invalidFix = "LOC-TEST-005";
  static const reverseGeocodeFailed = "LOC-TEST-006";
  static const unexpectedFailure = "LOC-TEST-007";
}

enum EmergencyLocationSource {
  freshGps,
  networkLocation,
  cachedDevice,
  phoneRelay,
  watchGps,
  manual,
  unavailable,
}

enum EmergencyLocationQuality {
  precise,
  acceptable,
  lowAccuracy,
  stale,
  invalid,
  unavailable,
}

/// Configurable quality thresholds for emergency location fixes.
abstract final class EmergencyLocationPolicy {
  static const balancedTimeout = Duration(seconds: 6);
  static const highAccuracyTimeout = Duration(seconds: 14);
  static const submissionDeadline = Duration(seconds: 8);
  static const trackerSampleTimeout = Duration(seconds: 8);
  static const streamInterval = Duration(seconds: 10);

  static const preciseAccuracyM = 25.0;
  static const preciseMaxAgeS = 30;
  static const acceptableAccuracyM = 100.0;
  static const acceptableMaxAgeS = 120;
  static const cachedAccuracyM = 250.0;
  static const cachedMaxAgeS = 600;

  static const retryDelays = <Duration>[
    Duration(seconds: 5),
    Duration(seconds: 10),
    Duration(seconds: 20),
  ];
  static const activeRetryInterval = Duration(seconds: 45);
}

class EmergencyLocationFix {
  const EmergencyLocationFix({
    required this.latitude,
    required this.longitude,
    this.accuracyMeters,
    required this.capturedAt,
    required this.receivedAt,
    required this.source,
    required this.isCached,
    required this.ageSeconds,
    required this.sequence,
    this.speed,
    this.heading,
    this.provider,
    required this.quality,
    required this.permissionState,
    required this.serviceEnabled,
    this.requestId,
  });

  final double latitude;
  final double longitude;
  final double? accuracyMeters;
  final DateTime capturedAt;
  final DateTime receivedAt;
  final EmergencyLocationSource source;
  final bool isCached;
  final int ageSeconds;
  final int sequence;
  final double? speed;
  final double? heading;
  final String? provider;
  final EmergencyLocationQuality quality;
  final LocationPermissionState permissionState;
  final bool serviceEnabled;
  final String? requestId;

  Position toPosition() {
    return Position(
      latitude: latitude,
      longitude: longitude,
      timestamp: capturedAt,
      accuracy: accuracyMeters ?? 0,
      altitude: 0,
      altitudeAccuracy: 0,
      heading: heading ?? 0,
      headingAccuracy: 0,
      speed: speed ?? 0,
      speedAccuracy: 0,
    );
  }

  bool get isAcceptableForEmergency =>
      quality == EmergencyLocationQuality.precise ||
      quality == EmergencyLocationQuality.acceptable ||
      (quality == EmergencyLocationQuality.lowAccuracy && isCached);

  bool get isUsableForSubmission => isAcceptableForEmergency;
}

EmergencyLocationSource mapLocationSource(LocationSource source) {
  switch (source) {
    case LocationSource.mobileGps:
      return EmergencyLocationSource.freshGps;
    case LocationSource.cachedMobile:
      return EmergencyLocationSource.cachedDevice;
    case LocationSource.unavailable:
      return EmergencyLocationSource.unavailable;
  }
}

String mapQualityToApi(EmergencyLocationQuality quality) {
  switch (quality) {
    case EmergencyLocationQuality.precise:
      return "precise";
    case EmergencyLocationQuality.acceptable:
      return "acceptable";
    case EmergencyLocationQuality.lowAccuracy:
      return "lowAccuracy";
    case EmergencyLocationQuality.stale:
      return "stale";
    case EmergencyLocationQuality.invalid:
      return "invalid";
    case EmergencyLocationQuality.unavailable:
      return "unavailable";
  }
}

String mapSourceToApi(EmergencyLocationSource source) {
  switch (source) {
    case EmergencyLocationSource.freshGps:
      return "freshGps";
    case EmergencyLocationSource.networkLocation:
      return "networkLocation";
    case EmergencyLocationSource.cachedDevice:
      return "cachedDevice";
    case EmergencyLocationSource.phoneRelay:
      return "phoneRelay";
    case EmergencyLocationSource.watchGps:
      return "watchGps";
    case EmergencyLocationSource.manual:
      return "manual";
    case EmergencyLocationSource.unavailable:
      return "unavailable";
  }
}

EmergencyLocationFix? evaluatePosition({
  required Position position,
  required EmergencyLocationSource source,
  required bool isCached,
  required LocationPermissionState permissionState,
  required bool serviceEnabled,
  int? sequence,
  String? requestId,
}) {
  final now = DateTime.now().toUtc();
  final capturedAt = position.timestamp.toUtc();
  final ageSeconds = now.difference(capturedAt).inSeconds;
  if (!_isValidCoordinate(position.latitude, position.longitude)) {
    return null;
  }
  if (ageSeconds < -30) {
    return null;
  }
  final accuracy = position.accuracy;
  if (!accuracy.isFinite || accuracy <= 0) {
    return null;
  }

  final quality = _evaluateQuality(
    accuracyMeters: accuracy,
    ageSeconds: ageSeconds,
    isCached: isCached,
  );
  if (quality == EmergencyLocationQuality.invalid ||
      quality == EmergencyLocationQuality.stale) {
    return null;
  }

  return EmergencyLocationFix(
    latitude: position.latitude,
    longitude: position.longitude,
    accuracyMeters: accuracy,
    capturedAt: capturedAt,
    receivedAt: now,
    source: source,
    isCached: isCached,
    ageSeconds: ageSeconds,
    sequence: sequence ?? 0,
    speed: position.speed,
    heading: position.heading,
    provider: isCached ? "cached" : "gps",
    quality: quality,
    permissionState: permissionState,
    serviceEnabled: serviceEnabled,
    requestId: requestId,
  );
}

EmergencyLocationQuality _evaluateQuality({
  required double accuracyMeters,
  required int ageSeconds,
  required bool isCached,
}) {
  if (accuracyMeters <= EmergencyLocationPolicy.preciseAccuracyM &&
      ageSeconds <= EmergencyLocationPolicy.preciseMaxAgeS) {
    return EmergencyLocationQuality.precise;
  }
  if (accuracyMeters <= EmergencyLocationPolicy.acceptableAccuracyM &&
      ageSeconds <= EmergencyLocationPolicy.acceptableMaxAgeS) {
    return EmergencyLocationQuality.acceptable;
  }
  if (isCached &&
      accuracyMeters <= EmergencyLocationPolicy.cachedAccuracyM &&
      ageSeconds <= EmergencyLocationPolicy.cachedMaxAgeS) {
    return EmergencyLocationQuality.lowAccuracy;
  }
  if (ageSeconds > EmergencyLocationPolicy.cachedMaxAgeS) {
    return EmergencyLocationQuality.stale;
  }
  return EmergencyLocationQuality.invalid;
}

bool _isValidCoordinate(double latitude, double longitude) {
  if (!latitude.isFinite || !longitude.isFinite) return false;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return false;
  }
  if (latitude == 0 && longitude == 0) return false;
  return true;
}

Map<String, Object?> locationMetadataFromFix(EmergencyLocationFix? fix,
    {required LocationPermissionState permissionState}) {
  if (fix == null || !fix.isUsableForSubmission) {
    final status = switch (permissionState) {
      LocationPermissionState.denied ||
      LocationPermissionState.deniedPermanently =>
        "denied",
      LocationPermissionState.serviceDisabled => "serviceDisabled",
      _ => "pending",
    };
    return {
      "locationSource": "unavailable",
      "locationStatus": status,
    };
  }

  return {
    "locationSource": mapSourceToApi(fix.source),
    "locationStatus": fix.isCached ? "cached" : "available",
    "isCached": fix.isCached,
    "ageSeconds": fix.ageSeconds,
    "accuracyMeters": fix.accuracyMeters,
    "quality": mapQualityToApi(fix.quality),
    if (fix.requestId != null) "locationRequestId": fix.requestId,
  };
}
