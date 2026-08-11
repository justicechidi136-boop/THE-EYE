import "live_video_connection_state.dart";

/// Authoritative live video session lifecycle (controller-owned).
enum LiveVideoLifecyclePhase {
  idle,
  preparing,
  connecting,
  connected,
  publishing,
  streaming,
  stopping,
  stopped,
  connectFailed,
  publishFailed,
  disconnectedUnexpectedly,
}

extension LiveVideoLifecyclePhaseRules on LiveVideoLifecyclePhase {
  bool get isActive =>
      this == LiveVideoLifecyclePhase.preparing ||
      this == LiveVideoLifecyclePhase.connecting ||
      this == LiveVideoLifecyclePhase.connected ||
      this == LiveVideoLifecyclePhase.publishing ||
      this == LiveVideoLifecyclePhase.streaming;

  bool get isTerminalFailure =>
      this == LiveVideoLifecyclePhase.connectFailed ||
      this == LiveVideoLifecyclePhase.publishFailed ||
      this == LiveVideoLifecyclePhase.disconnectedUnexpectedly;

  bool get allowsStart =>
      this == LiveVideoLifecyclePhase.idle ||
      this == LiveVideoLifecyclePhase.preparing ||
      this == LiveVideoLifecyclePhase.stopped ||
      isTerminalFailure;

  bool get allowsStop => isActive || this == LiveVideoLifecyclePhase.stopping;

  LiveVideoConnectionState toConnectionState({bool previewActive = false}) {
    switch (this) {
      case LiveVideoLifecyclePhase.idle:
        return LiveVideoConnectionState.idle;
      case LiveVideoLifecyclePhase.preparing:
        return previewActive
            ? LiveVideoConnectionState.previewing
            : LiveVideoConnectionState.connecting;
      case LiveVideoLifecyclePhase.connecting:
      case LiveVideoLifecyclePhase.connected:
      case LiveVideoLifecyclePhase.publishing:
        return LiveVideoConnectionState.connecting;
      case LiveVideoLifecyclePhase.streaming:
        return LiveVideoConnectionState.connected;
      case LiveVideoLifecyclePhase.stopping:
        return LiveVideoConnectionState.connecting;
      case LiveVideoLifecyclePhase.stopped:
        return previewActive
            ? LiveVideoConnectionState.previewing
            : LiveVideoConnectionState.idle;
      case LiveVideoLifecyclePhase.connectFailed:
      case LiveVideoLifecyclePhase.publishFailed:
        return LiveVideoConnectionState.failed;
      case LiveVideoLifecyclePhase.disconnectedUnexpectedly:
        return LiveVideoConnectionState.disconnected;
    }
  }
}

/// Validates and applies lifecycle transitions atomically.
class LiveVideoLifecycleStateMachine {
  LiveVideoLifecyclePhase phase = LiveVideoLifecyclePhase.idle;

  bool tryTransition(LiveVideoLifecyclePhase next) {
    if (!_isAllowed(phase, next)) return false;
    phase = next;
    return true;
  }

  void forceTransition(LiveVideoLifecyclePhase next) {
    phase = next;
  }

  static bool _isAllowed(LiveVideoLifecyclePhase from, LiveVideoLifecyclePhase to) {
    if (from == to) return true;
    switch (from) {
      case LiveVideoLifecyclePhase.idle:
        return to == LiveVideoLifecyclePhase.preparing ||
            to == LiveVideoLifecyclePhase.connecting;
      case LiveVideoLifecyclePhase.preparing:
        return to == LiveVideoLifecyclePhase.connecting ||
            to == LiveVideoLifecyclePhase.idle ||
            to == LiveVideoLifecyclePhase.connectFailed ||
            to == LiveVideoLifecyclePhase.stopping;
      case LiveVideoLifecyclePhase.connecting:
        return to == LiveVideoLifecyclePhase.connected ||
            to == LiveVideoLifecyclePhase.connectFailed ||
            to == LiveVideoLifecyclePhase.stopping;
      case LiveVideoLifecyclePhase.connected:
        return to == LiveVideoLifecyclePhase.publishing ||
            to == LiveVideoLifecyclePhase.connectFailed ||
            to == LiveVideoLifecyclePhase.stopping;
      case LiveVideoLifecyclePhase.publishing:
        return to == LiveVideoLifecyclePhase.streaming ||
            to == LiveVideoLifecyclePhase.publishFailed ||
            to == LiveVideoLifecyclePhase.stopping;
      case LiveVideoLifecyclePhase.streaming:
        return to == LiveVideoLifecyclePhase.stopping ||
            to == LiveVideoLifecyclePhase.disconnectedUnexpectedly;
      case LiveVideoLifecyclePhase.stopping:
        return to == LiveVideoLifecyclePhase.stopped ||
            to == LiveVideoLifecyclePhase.idle ||
            to == LiveVideoLifecyclePhase.connectFailed ||
            to == LiveVideoLifecyclePhase.publishFailed;
      case LiveVideoLifecyclePhase.stopped:
        return to == LiveVideoLifecyclePhase.idle ||
            to == LiveVideoLifecyclePhase.preparing ||
            to == LiveVideoLifecyclePhase.connecting;
      case LiveVideoLifecyclePhase.connectFailed:
      case LiveVideoLifecyclePhase.publishFailed:
      case LiveVideoLifecyclePhase.disconnectedUnexpectedly:
        return to == LiveVideoLifecyclePhase.idle ||
            to == LiveVideoLifecyclePhase.preparing ||
            to == LiveVideoLifecyclePhase.connecting ||
            to == LiveVideoLifecyclePhase.stopping;
    }
  }
}
