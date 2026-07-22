import "package:geolocator/geolocator.dart";

import "the_eye_enums.dart";

/// JSON payload builders matching NestJS DTO field names exactly.
abstract final class TheEyePayloads {
  static Map<String, Object?> liveVideoStart({
    required Position position,
    bool lowBandwidthMode = true,
    String sourceDeviceId = "mobile-primary",
  }) {
    return {
      ...gpsFields(position),
      "lowBandwidthMode": lowBandwidthMode,
      "sourceDeviceId": sourceDeviceId,
    };
  }

  static Map<String, Object?> liveVideoLocationUpdate({
    required Position position,
    String sourceDeviceId = "mobile-primary",
  }) {
    return {
      ...gpsFields(position),
      "capturedAt": position.timestamp.toUtc().toIso8601String(),
      "sourceDeviceId": sourceDeviceId,
    };
  }

  static Map<String, Object?> incidentLocationUpdate({
    required Position position,
    required int sequenceNumber,
    String sourceDeviceId = "mobile-primary",
  }) {
    return {
      ...gpsFields(position),
      "accuracyMeters": position.accuracy,
      "capturedAt": position.timestamp.toUtc().toIso8601String(),
      "sourceDeviceId": sourceDeviceId,
      "sequenceNumber": sequenceNumber,
    };
  }

  static Map<String, Object?> registerSmartwatchDevice({
    required String deviceId,
    required String provider,
    String? displayName,
    required bool standaloneCellular,
    required String pairingMethod,
    required bool failoverEnabled,
    required bool criticalAlertsEnabled,
    String? pairingCode,
    String? firebaseEnv,
  }) {
    final mode = standaloneCellular
        ? SmartwatchConnectivityMode.standaloneCellular
        : SmartwatchConnectivityMode.pairedPhone;
    return {
      "deviceId": deviceId,
      "provider": provider,
      if (displayName != null) "displayName": displayName,
      "connectivityMode": mode,
      "preferredMode": mode,
      "pairingMethod": pairingMethod,
      "failoverEnabled": failoverEnabled,
      "criticalAlertsEnabled": criticalAlertsEnabled,
      if (pairingCode != null && pairingCode.isNotEmpty)
        "pairingCode": pairingCode,
      if (firebaseEnv != null && firebaseEnv.isNotEmpty)
        "firebaseEnv": firebaseEnv,
    };
  }

  static Map<String, Object?> smartwatchGps({
    required Position position,
    required String deviceId,
    String? deviceSecret,
    required bool standaloneCellular,
    required int batteryLevel,
    required int signalStrength,
  }) {
    return {
      "deviceId": deviceId,
      if (deviceSecret != null && deviceSecret.isNotEmpty)
        "deviceSecret": deviceSecret,
      ...gpsFields(position),
      "capturedAt": position.timestamp.toUtc().toIso8601String(),
      "sourceMode": standaloneCellular
          ? SmartwatchConnectivityMode.standaloneCellular
          : SmartwatchConnectivityMode.pairedPhone,
      "batteryLevel": batteryLevel,
      "signalStrength": signalStrength,
    };
  }

  static Map<String, Object?> smartwatchSos({
    required Position position,
    required String deviceId,
    String? deviceSecret,
    required bool standaloneCellular,
    required int batteryLevel,
    required int signalStrength,
    required String emergencyMode,
    String description = "Smartwatch SOS triggered from citizen mobile app",
    int longPressDurationMs = TheEyeEnums.sosLongPressMinMs,
  }) {
    return {
      ...smartwatchGps(
        position: position,
        deviceId: deviceId,
        deviceSecret: deviceSecret,
        standaloneCellular: standaloneCellular,
        batteryLevel: batteryLevel,
        signalStrength: signalStrength,
      ),
      "description": description,
      "sourceDeviceId": deviceId,
      "emergencyMode": emergencyMode,
      "longPressDurationMs": longPressDurationMs,
    };
  }

  static Map<String, Object?> smartwatchHeartbeat({
    required String deviceId,
    String? deviceSecret,
    required bool standaloneCellular,
    required int batteryLevel,
    required int signalStrength,
    String firmwareVersion = "1.0.1",
    String firmwareSignatureStatus = FirmwareSignatureStatus.valid,
  }) {
    return {
      "deviceId": deviceId,
      if (deviceSecret != null && deviceSecret.isNotEmpty)
        "deviceSecret": deviceSecret,
      "connectivityMode": standaloneCellular
          ? SmartwatchConnectivityMode.standaloneCellular
          : SmartwatchConnectivityMode.pairedPhone,
      "pairedPhoneAvailable": !standaloneCellular,
      "internetAvailable": true,
      "batteryLevel": batteryLevel,
      "signalStrength": signalStrength,
      "firmwareVersion": firmwareVersion,
      "firmwareSignatureStatus": firmwareSignatureStatus,
    };
  }

  static Map<String, Object?> smartwatchOfflineSync({
    required String deviceId,
    String? deviceSecret,
    required List<Map<String, Object?>> events,
  }) {
    return {
      "deviceId": deviceId,
      if (deviceSecret != null && deviceSecret.isNotEmpty)
        "deviceSecret": deviceSecret,
      "events": events,
    };
  }

  static Map<String, Object?> reportIncident({
    required String type,
    required String description,
    required double latitude,
    required double longitude,
    double? manualLatitude,
    double? manualLongitude,
    String? manualAddress,
    String? title,
    String? address,
    bool anonymous = false,
    bool notifyEmergencyContacts = true,
    String? priority,
    List<String>? emergencyContactIds,
    List<Map<String, Object?>>? media,
    Map<String, Object?>? missingPerson,
    Map<String, Object?>? stolenVehicle,
    String? capturedAt,
  }) {
    return {
      "type": type,
      "description": description,
      "latitude": latitude,
      "longitude": longitude,
      if (manualLatitude != null) "manualLatitude": manualLatitude,
      if (manualLongitude != null) "manualLongitude": manualLongitude,
      if (manualAddress != null && manualAddress.isNotEmpty)
        "manualAddress": manualAddress,
      if (title != null && title.isNotEmpty) "title": title,
      if (address != null && address.isNotEmpty) "address": address,
      "anonymous": anonymous,
      "notifyEmergencyContacts": notifyEmergencyContacts,
      if (priority != null) "priority": priority,
      if (emergencyContactIds != null && emergencyContactIds.isNotEmpty)
        "emergencyContactIds": emergencyContactIds,
      if (media != null && media.isNotEmpty) "media": media,
      if (missingPerson != null && missingPerson.isNotEmpty)
        "missingPerson": missingPerson,
      if (stolenVehicle != null && stolenVehicle.isNotEmpty)
        "stolenVehicle": stolenVehicle,
      if (capturedAt != null && capturedAt.isNotEmpty) "capturedAt": capturedAt,
    };
  }

  static Map<String, Object?> gpsFields(Position position) {
    return {
      "latitude": position.latitude,
      "longitude": position.longitude,
      "accuracy": position.accuracy,
      "speed": position.speed,
      "heading": position.heading,
      "altitude": position.altitude,
      "capturedAt": position.timestamp.toUtc().toIso8601String(),
    };
  }
}
