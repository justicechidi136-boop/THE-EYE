import 'package:flutter/services.dart';

import '../config/field_device_mode.dart';

class FieldLauncherCapabilities {
  const FieldLauncherCapabilities({
    required this.buildDeviceMode,
    required this.isDeviceAdmin,
    required this.isDeviceOwner,
    required this.isProfileOwner,
    required this.lockTaskModeState,
    required this.homeAliasEnabled,
    required this.packageName,
  });

  final FieldDeviceMode buildDeviceMode;
  final bool isDeviceAdmin;
  final bool isDeviceOwner;
  final bool isProfileOwner;
  final int lockTaskModeState;
  final bool homeAliasEnabled;
  final String packageName;

  factory FieldLauncherCapabilities.fromMap(Map<dynamic, dynamic> map) {
    return FieldLauncherCapabilities(
      buildDeviceMode: FieldDeviceModeConfig.parse(map['buildDeviceMode']?.toString()),
      isDeviceAdmin: map['isDeviceAdmin'] == true,
      isDeviceOwner: map['isDeviceOwner'] == true,
      isProfileOwner: map['isProfileOwner'] == true,
      lockTaskModeState: (map['lockTaskModeState'] as num?)?.toInt() ?? 0,
      homeAliasEnabled: map['homeAliasEnabled'] == true,
      packageName: map['packageName']?.toString() ?? '',
    );
  }
}

/// Method-channel wrapper around Android FieldLauncherBridge.
class FieldLauncherPlatform {
  FieldLauncherPlatform({MethodChannel? channel})
      : _channel = channel ?? const MethodChannel('the_eye_field_ops/launcher');

  final MethodChannel _channel;

  Future<FieldDeviceMode> getBuildDeviceMode() async {
    try {
      final raw = await _channel.invokeMethod<String>('getBuildDeviceMode');
      return FieldDeviceModeConfig.parse(raw);
    } on MissingPluginException {
      return FieldDeviceModeConfig.compileTimeMode;
    } on PlatformException {
      return FieldDeviceModeConfig.compileTimeMode;
    }
  }

  Future<FieldLauncherCapabilities> getCapabilities() async {
    try {
      final map = await _channel.invokeMethod<Map<dynamic, dynamic>>('getCapabilities');
      if (map == null) {
        return FieldLauncherCapabilities.fromMap(const {});
      }
      return FieldLauncherCapabilities.fromMap(map);
    } on MissingPluginException {
      return FieldLauncherCapabilities(
        buildDeviceMode: FieldDeviceModeConfig.compileTimeMode,
        isDeviceAdmin: false,
        isDeviceOwner: false,
        isProfileOwner: false,
        lockTaskModeState: 0,
        homeAliasEnabled: false,
        packageName: '',
      );
    }
  }

  Future<void> setHomeAliasEnabled(bool enabled) async {
    try {
      await _channel.invokeMethod<void>('setHomeAliasEnabled', {'enabled': enabled});
    } on MissingPluginException {
      // no-op on non-Android / tests
    }
  }

  Future<bool> isPackageInstalled(String packageName) async {
    try {
      return await _channel.invokeMethod<bool>(
            'isPackageInstalled',
            {'packageName': packageName},
          ) ??
          false;
    } on MissingPluginException {
      return false;
    }
  }

  Future<bool> launchApprovedPackage(String packageName) async {
    try {
      return await _channel.invokeMethod<bool>(
            'launchApprovedPackage',
            {'packageName': packageName},
          ) ??
          false;
    } on MissingPluginException {
      return false;
    }
  }

  Future<bool> startLockTask() async {
    try {
      return await _channel.invokeMethod<bool>('startLockTask') ?? false;
    } on MissingPluginException {
      return false;
    }
  }

  Future<bool> stopLockTask() async {
    try {
      return await _channel.invokeMethod<bool>('stopLockTask') ?? false;
    } on MissingPluginException {
      return false;
    }
  }

  Future<bool> setLockTaskPackages(List<String> packages) async {
    try {
      return await _channel.invokeMethod<bool>(
            'setLockTaskPackages',
            {'packages': packages},
          ) ??
          false;
    } on MissingPluginException {
      return false;
    }
  }

  Future<void> openHomeSettings() async {
    try {
      await _channel.invokeMethod<void>('openHomeSettings');
    } on MissingPluginException {
      // no-op
    }
  }

  Future<void> openEmergencyDialer({String number = '112'}) async {
    try {
      await _channel.invokeMethod<void>('openEmergencyDialer', {'number': number});
    } on MissingPluginException {
      // no-op
    }
  }
}
