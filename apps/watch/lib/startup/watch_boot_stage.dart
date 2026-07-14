/// Ordered Wear OS cold-start stages shown on the branded boot screen.
enum WatchBootStage {
  localSettings,
  secureIdentity,
  firebase,
  pairingRestored,
  servicesReady,
}

extension WatchBootStageX on WatchBootStage {
  String get label => switch (this) {
        WatchBootStage.localSettings => 'Loading settings...',
        WatchBootStage.secureIdentity => 'Loading device identity...',
        WatchBootStage.firebase => 'Initializing Firebase...',
        WatchBootStage.pairingRestored => 'Restoring pairing...',
        WatchBootStage.servicesReady => 'Starting services...',
      };

  /// Fractional progress once this stage completes (5 equal stages).
  double get progress => (index + 1) / WatchBootStage.values.length;
}

class WatchBootResult {
  const WatchBootResult({
    required this.success,
    this.firebaseReady = false,
    this.degraded = false,
    this.statusNotes = const [],
    this.errorMessage,
  });

  final bool success;
  final bool firebaseReady;
  final bool degraded;
  final List<String> statusNotes;
  final String? errorMessage;
}
