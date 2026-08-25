import 'dart:convert';

import '../config/field_device_mode.dart';

/// Server-authoritative launcher / kiosk policy for a field device.
class LauncherPolicy {
  const LauncherPolicy({
    required this.deviceMode,
    required this.launcherEnabled,
    required this.kioskEnabled,
    required this.approvedApps,
    required this.settingsAccessLevel,
    required this.maintenanceModeAllowed,
    required this.emergencyDialerAllowed,
    required this.browserAllowed,
    required this.screenshotsAllowed,
    required this.usbPolicy,
    required this.autoLockMinutes,
    required this.visibleModules,
    required this.role,
    required this.fetchedAt,
    this.policyVersion = 1,
    this.agencyId,
    this.deviceReference,
    this.locked = false,
    this.lockReason,
  });

  final FieldDeviceMode deviceMode;
  final bool launcherEnabled;
  final bool kioskEnabled;
  final List<String> approvedApps;
  final String settingsAccessLevel; // none|restricted|supervisor
  final bool maintenanceModeAllowed;
  final bool emergencyDialerAllowed;
  final bool browserAllowed;
  final bool screenshotsAllowed;
  final String usbPolicy; // allow|charge_only|deny
  final int autoLockMinutes;
  final List<String> visibleModules;
  final String role;
  final DateTime fetchedAt;
  final int policyVersion;
  final String? agencyId;
  final String? deviceReference;
  final bool locked;
  final String? lockReason;

  bool get isLockedDownShell =>
      FieldDeviceModeConfig.isLauncherShell(deviceMode) || launcherEnabled;

  bool get settingsAllowed =>
      settingsAccessLevel == 'restricted' ||
      settingsAccessLevel == 'supervisor';

  factory LauncherPolicy.defaults({
    FieldDeviceMode mode = FieldDeviceMode.standard,
    String role = 'officer',
  }) {
    return LauncherPolicy(
      deviceMode: mode,
      launcherEnabled: FieldDeviceModeConfig.isLauncherShell(mode),
      kioskEnabled: mode == FieldDeviceMode.managedKiosk,
      approvedApps: const [
        'com.google.android.apps.maps',
        'com.android.camera2',
        'com.google.android.dialer',
        'com.android.chrome',
      ],
      settingsAccessLevel:
          mode == FieldDeviceMode.standard ? 'none' : 'restricted',
      maintenanceModeAllowed:
          true, // staging escape; production policy may disable
      emergencyDialerAllowed: true,
      browserAllowed: true,
      screenshotsAllowed: mode != FieldDeviceMode.managedKiosk,
      usbPolicy: mode == FieldDeviceMode.managedKiosk ? 'charge_only' : 'allow',
      autoLockMinutes: 15,
      visibleModules: modulesForRole(role),
      role: role,
      fetchedAt: DateTime.now().toUtc(),
    );
  }

  static List<String> modulesForRole(String role) {
    switch (role.toLowerCase()) {
      case 'checkpoint':
        return const [
          'checkpoint',
          'assignments',
          'bolo',
          'broadcasts',
          'backup',
          'comms',
          'device_status',
          'officer_safety',
        ];
      case 'drone':
        return const [
          'drone',
          'incident_map',
          'assignments',
          'broadcasts',
          'comms',
          'backup',
          'device_status',
          'officer_safety',
        ];
      case 'supervisor':
      case 'commander':
        return const [
          'dashboard',
          'patrol',
          'checkpoint',
          'assignments',
          'incident_map',
          'bolo',
          'broadcasts',
          'drone',
          'comms',
          'backup',
          'officer_safety',
          'device_status',
        ];
      case 'patrol':
      case 'officer':
      default:
        return const [
          'dashboard',
          'patrol',
          'assignments',
          'incident_map',
          'bolo',
          'broadcasts',
          'comms',
          'backup',
          'officer_safety',
          'device_status',
        ];
    }
  }

  factory LauncherPolicy.fromJson(Map<String, dynamic> json) {
    final role = json['role']?.toString() ?? 'officer';
    final modules =
        (json['visibleModules'] as List?)?.map((e) => e.toString()).toList() ??
        modulesForRole(role);
    return LauncherPolicy(
      deviceMode: FieldDeviceModeConfig.parse(json['deviceMode']?.toString()),
      launcherEnabled: json['launcherEnabled'] != false,
      kioskEnabled: json['kioskEnabled'] == true,
      approvedApps:
          (json['approvedApps'] as List?)?.map((e) => e.toString()).toList() ??
          const [],
      settingsAccessLevel: json['settingsAccessLevel']?.toString() ?? 'none',
      maintenanceModeAllowed: json['maintenanceModeAllowed'] == true,
      emergencyDialerAllowed: json['emergencyDialerAllowed'] != false,
      browserAllowed: json['browserAllowed'] != false,
      screenshotsAllowed: json['screenshotsAllowed'] != false,
      usbPolicy: json['usbPolicy']?.toString() ?? 'allow',
      autoLockMinutes: (json['autoLockMinutes'] as num?)?.toInt() ?? 15,
      visibleModules: modules,
      role: role,
      fetchedAt:
          DateTime.tryParse(json['fetchedAt']?.toString() ?? '') ??
          DateTime.now().toUtc(),
      policyVersion: (json['policyVersion'] as num?)?.toInt() ?? 1,
      agencyId: json['agencyId']?.toString(),
      deviceReference: json['deviceReference']?.toString(),
      locked: json['locked'] == true,
      lockReason: json['lockReason']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
    'deviceMode': FieldDeviceModeConfig.apiValue(deviceMode),
    'launcherEnabled': launcherEnabled,
    'kioskEnabled': kioskEnabled,
    'approvedApps': approvedApps,
    'settingsAccessLevel': settingsAccessLevel,
    'maintenanceModeAllowed': maintenanceModeAllowed,
    'emergencyDialerAllowed': emergencyDialerAllowed,
    'browserAllowed': browserAllowed,
    'screenshotsAllowed': screenshotsAllowed,
    'usbPolicy': usbPolicy,
    'autoLockMinutes': autoLockMinutes,
    'visibleModules': visibleModules,
    'role': role,
    'fetchedAt': fetchedAt.toIso8601String(),
    'policyVersion': policyVersion,
    'agencyId': agencyId,
    'deviceReference': deviceReference,
    'locked': locked,
    'lockReason': lockReason,
  };

  String encodeCache() => jsonEncode(toJson());

  static LauncherPolicy? tryDecodeCache(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    try {
      return LauncherPolicy.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }
}
