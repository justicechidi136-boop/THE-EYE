import 'emergency_mode.dart';

enum SosLifecycle {
  idle,
  holding,
  countdown,
  submitting,
  active,
  failed,
  cancelled,
}

class SosEventState {
  const SosEventState({
    required this.lifecycle,
    this.emergencyMode = WatchEmergencyMode.normalSos,
    this.holdProgressMs = 0,
    this.countdownSeconds = 0,
    this.sosEventId,
    this.incidentId,
    this.errorMessage,
    this.idempotencyKey,
    this.latitude,
    this.longitude,
  });

  final SosLifecycle lifecycle;
  final WatchEmergencyMode emergencyMode;
  final int holdProgressMs;
  final int countdownSeconds;
  final String? sosEventId;
  final String? incidentId;
  final String? errorMessage;
  final String? idempotencyKey;
  final double? latitude;
  final double? longitude;

  bool get isActive =>
      lifecycle == SosLifecycle.active || lifecycle == SosLifecycle.submitting;

  SosEventState copyWith({
    SosLifecycle? lifecycle,
    WatchEmergencyMode? emergencyMode,
    int? holdProgressMs,
    int? countdownSeconds,
    String? sosEventId,
    String? incidentId,
    String? errorMessage,
    String? idempotencyKey,
    double? latitude,
    double? longitude,
  }) {
    return SosEventState(
      lifecycle: lifecycle ?? this.lifecycle,
      emergencyMode: emergencyMode ?? this.emergencyMode,
      holdProgressMs: holdProgressMs ?? this.holdProgressMs,
      countdownSeconds: countdownSeconds ?? this.countdownSeconds,
      sosEventId: sosEventId ?? this.sosEventId,
      incidentId: incidentId ?? this.incidentId,
      errorMessage: errorMessage,
      idempotencyKey: idempotencyKey ?? this.idempotencyKey,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
    );
  }
}
