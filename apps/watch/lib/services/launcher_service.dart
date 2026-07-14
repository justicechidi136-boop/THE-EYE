import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import '../config/watch_flavor.dart';

/// Launchable app entry from native PackageManager.
class WatchLaunchableApp {
  const WatchLaunchableApp({
    required this.packageName,
    required this.label,
    this.systemApp = false,
  });

  factory WatchLaunchableApp.fromMap(Map<dynamic, dynamic> map) {
    return WatchLaunchableApp(
      packageName: map['packageName'] as String? ?? '',
      label: map['label'] as String? ?? map['packageName'] as String? ?? '',
      systemApp: map['systemApp'] == 'true',
    );
  }

  final String packageName;
  final String label;
  final bool systemApp;
}

/// Native Wear OS launcher bridge (`com.theeye.watch/launcher`).
class LauncherService {
  LauncherService({MethodChannel? channel})
      : _channel = channel ?? const MethodChannel('com.theeye.watch/launcher');

  final MethodChannel _channel;

  Future<bool> isDefaultHome() async {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) {
      return false;
    }
    try {
      final result = await _channel.invokeMethod<bool>('isDefaultHome');
      return result ?? false;
    } on PlatformException {
      return false;
    }
  }

  Future<void> requestDefaultHome() async {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return;
    try {
      await _channel.invokeMethod<void>('requestDefaultHome');
    } on PlatformException {
      // No-op on unsupported platforms.
    }
  }

  Future<void> openHomeSettings() async {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return;
    try {
      await _channel.invokeMethod<void>('openHomeSettings');
    } on PlatformException {
      // No-op on unsupported platforms.
    }
  }

  Future<void> openSystemSettings() async {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return;
    try {
      await _channel.invokeMethod<void>('openSystemSettings');
    } on PlatformException {
      // No-op on unsupported platforms.
    }
  }

  Future<List<WatchLaunchableApp>> listApps() async {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) {
      return const [];
    }
    try {
      final result = await _channel.invokeMethod<List<dynamic>>('listApps');
      return (result ?? [])
          .whereType<Map<dynamic, dynamic>>()
          .map(WatchLaunchableApp.fromMap)
          .where((app) => app.packageName.isNotEmpty)
          .toList();
    } on PlatformException {
      return const [];
    }
  }

  Future<bool> launchApp(String packageName) async {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) {
      return false;
    }
    try {
      final result = await _channel.invokeMethod<bool>(
        'launchApp',
        {'packageName': packageName},
      );
      return result ?? false;
    } on PlatformException {
      return false;
    }
  }

  Future<WatchLauncherMode> getLauncherMode() async {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) {
      return WatchLauncherMode.consumer;
    }
    try {
      final result = await _channel.invokeMethod<String>('getLauncherMode');
      if (result == 'managed') return WatchLauncherMode.managed;
      return WatchLauncherMode.consumer;
    } on PlatformException {
      return WatchLauncherMode.consumer;
    }
  }

  Future<bool> isDebugBuild() async {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) {
      return kDebugMode;
    }
    try {
      final result = await _channel.invokeMethod<bool>('isDebugBuild');
      return result ?? kDebugMode;
    } on PlatformException {
      return kDebugMode;
    }
  }
}
