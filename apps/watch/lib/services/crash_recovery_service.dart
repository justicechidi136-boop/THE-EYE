import 'package:flutter/services.dart';

class CrashRecoveryState {
  const CrashRecoveryState({
    this.uncleanShutdown = false,
    this.activeEmergency = false,
    this.queuedSos = false,
    this.crashCount = 0,
    this.recoveryLoopBlocked = false,
    this.corrupted = false,
  });

  final bool uncleanShutdown;
  final bool activeEmergency;
  final bool queuedSos;
  final int crashCount;
  final bool recoveryLoopBlocked;
  final bool corrupted;

  bool get shouldRestoreEmergency =>
      !recoveryLoopBlocked &&
      !corrupted &&
      uncleanShutdown &&
      (activeEmergency || queuedSos);

  factory CrashRecoveryState.fromMap(Map<dynamic, dynamic>? raw) {
    if (raw == null || raw.isEmpty) return const CrashRecoveryState();
    return CrashRecoveryState(
      uncleanShutdown: raw['uncleanShutdown'] == true,
      activeEmergency: raw['activeEmergency'] == true,
      queuedSos: raw['queuedSos'] == true,
      crashCount: (raw['crashCount'] as num?)?.toInt() ?? 0,
      recoveryLoopBlocked: raw['recoveryLoopBlocked'] == true,
      corrupted: raw['corrupted'] == true,
    );
  }
}

class CrashRecoveryService {
  CrashRecoveryService({MethodChannel? channel})
      : _channel = channel ?? const MethodChannel('com.theeye.watch/crash');

  final MethodChannel _channel;

  Future<CrashRecoveryState> readState() async {
    try {
      final raw = await _channel.invokeMethod<Map<dynamic, dynamic>>('readState');
      return CrashRecoveryState.fromMap(raw);
    } on PlatformException {
      return const CrashRecoveryState();
    }
  }

  Future<void> markCleanShutdown() async {
    try {
      await _channel.invokeMethod<void>('markCleanShutdown');
    } on PlatformException {
      // Best effort only.
    }
  }

  Future<void> markUncleanShutdown() async {
    try {
      await _channel.invokeMethod<void>('markUncleanShutdown');
    } on PlatformException {
      // Best effort only.
    }
  }

  Future<void> snapshotEmergencyState({
    required bool activeEmergency,
    required bool queuedSos,
  }) async {
    try {
      await _channel.invokeMethod<void>('snapshotEmergencyState', {
        'activeEmergency': activeEmergency,
        'queuedSos': queuedSos,
      });
    } on PlatformException {
      // Best effort only.
    }
  }

  Future<void> clearRecovery() async {
    try {
      await _channel.invokeMethod<void>('clearRecovery');
    } on PlatformException {
      // Best effort only.
    }
  }

  Future<void> recordFlutterCrash() async {
    try {
      await _channel.invokeMethod<void>('recordFlutterCrash');
    } on PlatformException {
      // Best effort only.
    }
  }
}
