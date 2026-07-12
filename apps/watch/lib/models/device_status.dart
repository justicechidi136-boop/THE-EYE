import 'connectivity_mode.dart';

class DeviceStatusSnapshot {
  const DeviceStatusSnapshot({
    required this.deviceId,
    required this.batteryLevel,
    required this.signalStrength,
    required this.connectivityMode,
    required this.isOnline,
    required this.firmwareVersion,
    this.lastSeenAt,
    this.pairedPhoneAvailable = false,
    this.internetAvailable = false,
    this.failoverEnabled = true,
  });

  final String deviceId;
  final int batteryLevel;
  final int signalStrength;
  final WatchConnectivityMode connectivityMode;
  final bool isOnline;
  final String firmwareVersion;
  final DateTime? lastSeenAt;
  final bool pairedPhoneAvailable;
  final bool internetAvailable;
  final bool failoverEnabled;

  DeviceStatusSnapshot copyWith({
    int? batteryLevel,
    int? signalStrength,
    WatchConnectivityMode? connectivityMode,
    bool? isOnline,
    DateTime? lastSeenAt,
    bool? pairedPhoneAvailable,
    bool? internetAvailable,
  }) {
    return DeviceStatusSnapshot(
      deviceId: deviceId,
      batteryLevel: batteryLevel ?? this.batteryLevel,
      signalStrength: signalStrength ?? this.signalStrength,
      connectivityMode: connectivityMode ?? this.connectivityMode,
      isOnline: isOnline ?? this.isOnline,
      firmwareVersion: firmwareVersion,
      lastSeenAt: lastSeenAt ?? this.lastSeenAt,
      pairedPhoneAvailable: pairedPhoneAvailable ?? this.pairedPhoneAvailable,
      internetAvailable: internetAvailable ?? this.internetAvailable,
      failoverEnabled: failoverEnabled,
    );
  }
}
