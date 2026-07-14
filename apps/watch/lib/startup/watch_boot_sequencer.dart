import 'dart:async';

import '../config/firebase_bootstrap.dart';
import '../services/watch_app_services.dart';
import 'watch_boot_stage.dart';

typedef BootStageCallback = void Function(
  WatchBootStage stage,
  String status,
  double progress,
);

/// Runs cold-start stages with per-stage timeouts so Wear never hangs on
/// network / FCM / phone APIs during boot.
class WatchBootSequencer {
  WatchBootSequencer({
    required this.services,
    this.firebaseInitializer = initializeWatchFirebase,
    this.stageTimeout = const Duration(seconds: 4),
    this.pushTimeout = const Duration(seconds: 3),
    this.overallTimeout = const Duration(seconds: 18),
  });

  final WatchAppServices services;
  final Future<FirebaseBootstrapResult> Function() firebaseInitializer;
  final Duration stageTimeout;
  final Duration pushTimeout;
  final Duration overallTimeout;

  Future<WatchBootResult> run({BootStageCallback? onStage}) async {
    final notes = <String>[];
    var firebaseReady = false;

    try {
      return await _runStages(
        onStage: onStage,
        notes: notes,
        firebaseReadyOut: (v) => firebaseReady = v,
      ).timeout(overallTimeout);
    } on TimeoutException {
      notes.add('Boot timed out — continuing offline');
      // Best-effort local restore so launcher can still open.
      try {
        await services.pairing.initialize().timeout(const Duration(seconds: 2));
      } catch (_) {}
      return WatchBootResult(
        success: true,
        firebaseReady: firebaseReady,
        degraded: true,
        statusNotes: notes,
      );
    } catch (error) {
      return WatchBootResult(
        success: false,
        firebaseReady: firebaseReady,
        degraded: true,
        statusNotes: notes,
        errorMessage: error.toString(),
      );
    }
  }

  Future<WatchBootResult> _runStages({
    required BootStageCallback? onStage,
    required List<String> notes,
    required void Function(bool) firebaseReadyOut,
  }) async {
    onStage?.call(
      WatchBootStage.localSettings,
      WatchBootStage.localSettings.label,
      0.05,
    );
    await _guarded(
      () async {
        await services.preferences.isPaired();
        await services.preferences.isLauncherOnboardingDismissed();
        await services.preferences.loadOfflineQueue();
      },
      stageTimeout,
      onTimeout: () => notes.add('Settings load slow'),
      onError: (e) => notes.add('Settings: $e'),
    );
    onStage?.call(
      WatchBootStage.localSettings,
      'Settings ready',
      WatchBootStage.localSettings.progress,
    );

    onStage?.call(
      WatchBootStage.secureIdentity,
      WatchBootStage.secureIdentity.label,
      WatchBootStage.localSettings.progress,
    );
    await _guarded(
      () async {
        await services.credentials.readDeviceId();
        await services.credentials.readDeviceSecret();
        await services.standaloneAuth.hydrateApiAuth();
      },
      stageTimeout,
      onTimeout: () => notes.add('Identity load timed out'),
      onError: (e) => notes.add('Identity: $e'),
    );
    onStage?.call(
      WatchBootStage.secureIdentity,
      'Device identity ready',
      WatchBootStage.secureIdentity.progress,
    );

    onStage?.call(
      WatchBootStage.firebase,
      WatchBootStage.firebase.label,
      WatchBootStage.secureIdentity.progress,
    );
    final firebase = await _guarded(
      firebaseInitializer,
      stageTimeout,
      onTimeout: () {
        notes.add('Firebase timed out — offline mode');
        return const FirebaseBootstrapResult(
          initialized: false,
          errorMessage: 'Firebase initialization timed out',
        );
      },
      onError: (e) {
        notes.add('Firebase unavailable');
        return FirebaseBootstrapResult(
          initialized: false,
          errorMessage: e.toString(),
        );
      },
    );
    final firebaseReady = firebase?.initialized ?? false;
    firebaseReadyOut(firebaseReady);
    if (!firebaseReady) {
      notes.add(firebase?.errorMessage ?? 'Firebase not ready');
    }
    onStage?.call(
      WatchBootStage.firebase,
      firebaseReady ? 'Firebase ready' : 'Firebase offline',
      WatchBootStage.firebase.progress,
    );

    onStage?.call(
      WatchBootStage.pairingRestored,
      WatchBootStage.pairingRestored.label,
      WatchBootStage.firebase.progress,
    );
    await _guarded(
      () => services.pairing.initialize(),
      stageTimeout,
      onTimeout: () => notes.add('Pairing restore timed out'),
      onError: (e) => notes.add('Pairing: $e'),
    );
    onStage?.call(
      WatchBootStage.pairingRestored,
      services.pairing.state.isPaired ? 'Paired' : 'Not paired',
      WatchBootStage.pairingRestored.progress,
    );

    onStage?.call(
      WatchBootStage.servicesReady,
      WatchBootStage.servicesReady.label,
      WatchBootStage.pairingRestored.progress,
    );
    await _guarded(
      () => services.startRuntimeServices(
        firebaseReady: firebaseReady,
        pushTimeout: pushTimeout,
      ),
      stageTimeout + pushTimeout,
      onTimeout: () => notes.add('Services timed out — degraded'),
      onError: (e) => notes.add('Services: $e'),
    );
    onStage?.call(
      WatchBootStage.servicesReady,
      notes.isEmpty ? 'Ready' : 'Ready (degraded)',
      WatchBootStage.servicesReady.progress,
    );

    return WatchBootResult(
      success: true,
      firebaseReady: firebaseReady,
      degraded: notes.isNotEmpty,
      statusNotes: notes,
    );
  }

  Future<T?> _guarded<T>(
    Future<T> Function() action,
    Duration timeout, {
    T? Function()? onTimeout,
    T? Function(Object error)? onError,
  }) async {
    try {
      return await action().timeout(timeout);
    } on TimeoutException {
      return onTimeout?.call();
    } catch (error) {
      return onError?.call(error);
    }
  }
}
