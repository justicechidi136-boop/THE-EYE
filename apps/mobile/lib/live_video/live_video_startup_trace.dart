import "../emergency/live_video_startup_phase.dart";

class LiveVideoStartupTrace {
  LiveVideoStartupTrace({String? clientTraceId})
      : clientTraceId = clientTraceId ?? _newTraceId();

  final String clientTraceId;
  LiveVideoStartupPhase? phase;
  String? lastRequestId;
  final Map<LiveVideoStartupPhase, int> _phaseStartedMs = {};
  final Map<LiveVideoStartupPhase, int> _phaseDurationMs = {};

  static String _newTraceId() =>
      "lv-${DateTime.now().toUtc().millisecondsSinceEpoch}";

  void begin(LiveVideoStartupPhase next) {
    final now = DateTime.now().millisecondsSinceEpoch;
    if (phase != null) {
      final started = _phaseStartedMs[phase!];
      if (started != null) {
        _phaseDurationMs[phase!] = now - started;
      }
    }
    phase = next;
    _phaseStartedMs[next] = now;
  }

  void recordRequestId(String? requestId) {
    if (requestId != null && requestId.isNotEmpty) {
      lastRequestId = requestId;
    }
  }

  Map<String, Object?> toDiagnosticMap() {
    return {
      "clientTraceId": clientTraceId,
      "phase": phase?.name,
      "lastRequestId": lastRequestId,
      "phaseDurationsMs": _phaseDurationMs.map(
        (key, value) => MapEntry(key.name, value),
      ),
    };
  }
}
