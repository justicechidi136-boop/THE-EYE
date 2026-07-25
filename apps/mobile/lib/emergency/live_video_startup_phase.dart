/// Explicit phases for SOS Live Video startup (incident first, video second).
enum LiveVideoStartupPhase {
  idle,
  validatingSession,
  checkingPermissions,
  creatingIncident,
  acquiringLocation,
  startingForegroundService,
  requestingLiveKitToken,
  connectingRoom,
  streaming,
  recovering,
  failed,
  disposed,
}

extension LiveVideoStartupPhaseLabels on LiveVideoStartupPhase {
  String get label {
    return switch (this) {
      LiveVideoStartupPhase.idle => "Ready",
      LiveVideoStartupPhase.validatingSession => "Checking session",
      LiveVideoStartupPhase.checkingPermissions => "Checking camera access",
      LiveVideoStartupPhase.creatingIncident => "Creating emergency",
      LiveVideoStartupPhase.acquiringLocation => "Acquiring location",
      LiveVideoStartupPhase.startingForegroundService =>
        "Starting location service",
      LiveVideoStartupPhase.requestingLiveKitToken => "Requesting video token",
      LiveVideoStartupPhase.connectingRoom => "Connecting live video",
      LiveVideoStartupPhase.streaming => "Live stream active",
      LiveVideoStartupPhase.recovering => "Recovering",
      LiveVideoStartupPhase.failed => "Video unavailable",
      LiveVideoStartupPhase.disposed => "Closed",
    };
  }

  bool get isTerminal {
    return this == LiveVideoStartupPhase.streaming ||
        this == LiveVideoStartupPhase.failed ||
        this == LiveVideoStartupPhase.disposed;
  }
}
