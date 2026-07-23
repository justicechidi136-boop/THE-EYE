import 'dart:async';

import 'package:uuid/uuid.dart';

import '../api/watch_api_client.dart';
import '../api/watch_api_paths.dart';
import '../models/active_emergency_status.dart';
import '../models/connectivity_mode.dart';
import '../models/emergency_mode.dart';
import '../models/offline_event.dart';
import '../models/sos_event.dart';
import '../pairing/watch_companion_transport.dart';
import '../storage/encrypted_offline_queue_store.dart';
import '../storage/secure_credential_store.dart';
import 'connectivity_service.dart';
import 'emergency_foreground_service.dart';
import 'location_service.dart';
import 'vibration_service.dart';

class SosService {
  SosService({
    required WatchApiClient api,
    required SecureCredentialStore credentials,
    required PreferencesStore preferences,
    required ConnectivityService connectivity,
    required LocationService location,
    required VibrationService vibration,
    EncryptedOfflineQueueStore? offlineQueue,
    EmergencyForegroundService? emergencyForeground,
    String Function()? idGenerator,
    this.holdDurationMs = 3000,
    this.tickIntervalMs = 100,
  })  : _api = api,
        _credentials = credentials,
        _connectivity = connectivity,
        _location = location,
        _vibration = vibration,
        _offlineQueue = offlineQueue ??
            EncryptedOfflineQueueStore(legacyPreferences: preferences),
        _emergencyForeground = emergencyForeground ?? EmergencyForegroundService(),
        _idGenerator = idGenerator ?? (() => const Uuid().v4());

  final WatchApiClient _api;
  final SecureCredentialStore _credentials;
  final ConnectivityService _connectivity;
  final LocationService _location;
  final VibrationService _vibration;
  final EncryptedOfflineQueueStore _offlineQueue;
  final EmergencyForegroundService _emergencyForeground;
  final String Function() _idGenerator;

  final int holdDurationMs;
  final int tickIntervalMs;

  final _stateController = StreamController<SosEventState>.broadcast();
  SosEventState _state = const SosEventState(lifecycle: SosLifecycle.idle);
  Timer? _holdTimer;
  final Set<String> _submittedIdempotencyKeys = {};

  Stream<SosEventState> get states => _stateController.stream;
  SosEventState get state => _state;

  void _emit(SosEventState next) {
    _state = next;
    _stateController.add(next);
  }

  void beginHold({WatchEmergencyMode emergencyMode = WatchEmergencyMode.normalSos}) {
    if (_state.lifecycle != SosLifecycle.idle &&
        _state.lifecycle != SosLifecycle.failed &&
        _state.lifecycle != SosLifecycle.cancelled) {
      return;
    }

    final discreet = emergencyMode == WatchEmergencyMode.silentSos;
    _vibration.setEnabled(!discreet);

    _holdTimer?.cancel();
    _emit(SosEventState(
      lifecycle: SosLifecycle.holding,
      holdProgressMs: 0,
      emergencyMode: emergencyMode,
    ));
    if (!discreet) {
      _vibration.pulse();
    }

    var elapsed = 0;
    _holdTimer =
        Timer.periodic(Duration(milliseconds: tickIntervalMs), (timer) {
      elapsed += tickIntervalMs;
      if (elapsed >= holdDurationMs) {
        timer.cancel();
        _onHoldComplete();
        return;
      }
      _emit(_state.copyWith(
        lifecycle: SosLifecycle.holding,
        holdProgressMs: elapsed,
      ));
      if (!discreet && elapsed % 500 == 0) {
        _vibration.pulse();
      }
    });
  }

  void cancelHold() {
    _holdTimer?.cancel();
    _holdTimer = null;
    _emit(const SosEventState(lifecycle: SosLifecycle.cancelled));
    _vibration.cancelPattern();
    Future<void>.delayed(const Duration(milliseconds: 300), () {
      if (_state.lifecycle == SosLifecycle.cancelled) {
        _emit(const SosEventState(lifecycle: SosLifecycle.idle));
      }
    });
  }

  void _onHoldComplete() {
    final discreet = _state.emergencyMode == WatchEmergencyMode.silentSos;
    _emit(_state.copyWith(
      lifecycle: SosLifecycle.countdown,
      holdProgressMs: holdDurationMs,
      countdownSeconds: 3,
    ));
    if (!discreet) {
      _vibration.confirmSos();
    }

    var seconds = 3;
    Timer.periodic(const Duration(seconds: 1), (timer) {
      seconds -= 1;
      if (seconds <= 0) {
        timer.cancel();
        unawaited(submitSos(emergencyMode: _state.emergencyMode));
        return;
      }
      _emit(_state.copyWith(countdownSeconds: seconds));
    });
  }

  Future<void> submitSos({
    WatchEmergencyMode emergencyMode = WatchEmergencyMode.normalSos,
    String? description,
  }) async {
    final idempotencyKey = _idGenerator();
    if (_submittedIdempotencyKeys.contains(idempotencyKey)) return;

    _emit(_state.copyWith(
      lifecycle: SosLifecycle.submitting,
      emergencyMode: emergencyMode,
      idempotencyKey: idempotencyKey,
    ));

    final deviceId = await _credentials.readDeviceId();
    final deviceSecret = await _credentials.readDeviceSecret();
    if (deviceId == null || deviceSecret == null) {
      _emit(_state.copyWith(
        lifecycle: SosLifecycle.failed,
        errorMessage: 'Device is not paired',
      ));
      return;
    }

    final position = await _location.getCurrentPosition();
    final payload = {
      'deviceId': deviceId,
      'deviceSecret': deviceSecret,
      'latitude': position?.latitude ?? 0,
      'longitude': position?.longitude ?? 0,
      if (position != null) 'accuracy': position.accuracy,
      if (position != null) 'speed': position.speed,
      if (position != null) 'heading': position.heading,
      if (position != null) 'altitude': position.altitude,
      'capturedAt': DateTime.now().toUtc().toIso8601String(),
      'sourceMode': _connectivity.activeMode.apiValue,
      'emergencyMode': emergencyMode.apiValue,
      'longPressDurationMs': holdDurationMs,
      if (description != null) 'description': description,
      'metadata': {
        'idempotencyKey': idempotencyKey,
        'client': 'watch-os',
      },
    };

    if (_connectivity.activeMode == WatchConnectivityMode.offline) {
      await _enqueueOfflineSos(payload, idempotencyKey);
      await _emergencyForeground.start(
        silent: emergencyMode == WatchEmergencyMode.silentSos,
      );
      _emit(_state.copyWith(
        lifecycle: SosLifecycle.failed,
        errorMessage: 'Queued offline — will retry when connected',
        offlineQueued: true,
      ));
      return;
    }

    try {
      final response = await _api.post(WatchApiPaths.sos, body: payload);
      _submittedIdempotencyKeys.add(idempotencyKey);
      final data = response['data'] as Map<String, dynamic>? ?? response;
      final incident = response['incident'] as Map<String, dynamic>?;
      final sosEventId = data['id'] as String?;
      final incidentId = incident?['id'] as String?;

      _location.startEmergencyTracking(sosEventId: sosEventId);
      await _emergencyForeground.start(
        sosEventId: sosEventId,
        incidentId: incidentId,
        silent: emergencyMode == WatchEmergencyMode.silentSos,
      );
      _emit(_state.copyWith(
        lifecycle: SosLifecycle.active,
        sosEventId: sosEventId,
        incidentId: incidentId,
        latitude: position?.latitude,
        longitude: position?.longitude,
        offlineQueued: false,
      ));
      if (emergencyMode != WatchEmergencyMode.silentSos) {
        _vibration.confirmSos();
      }
    } catch (error) {
      await _enqueueOfflineSos(payload, idempotencyKey);
      await _emergencyForeground.start(
        silent: emergencyMode == WatchEmergencyMode.silentSos,
      );
      _emit(_state.copyWith(
        lifecycle: SosLifecycle.failed,
        errorMessage: error.toString(),
        offlineQueued: true,
      ));
    }
  }

  Future<void> _enqueueOfflineSos(
    Map<String, dynamic> payload,
    String idempotencyKey,
  ) async {
    if (!_offlineQueue.isAvailable) {
      throw StateError('Encrypted offline queue unavailable');
    }
    final queue = await _offlineQueue.loadQueue();
    if (queue.any((event) => event.idempotencyKey == idempotencyKey)) return;
    if (_submittedIdempotencyKeys.contains(idempotencyKey)) return;
    queue.add(OfflineEvent(
      id: _idGenerator(),
      type: OfflineEventType.sos,
      payload: payload,
      occurredAt: DateTime.now(),
      idempotencyKey: idempotencyKey,
    ));
    await _offlineQueue.saveQueue(queue);
  }

  Future<void> restoreEmergencyAfterBoot() async {
    await _emergencyForeground.restoreAfterBoot();
    if (!_offlineQueue.isAvailable) return;
    final queue = await _offlineQueue.loadQueue();
    if (queue.isNotEmpty || _emergencyForeground.isActive) {
      await _emergencyForeground.start(silent: false);
    }
  }

  Future<void> syncEmergencyTracking() async {
    final sosEventId = _state.sosEventId;
    if (sosEventId == null) return;
    try {
      final response =
          await _api.get(WatchApiPaths.emergencyTracking(sosEventId));
      final data = response['data'] as Map<String, dynamic>? ?? response;
      final event = data['event'] as Map<String, dynamic>?;
      final latest = data['latest'] as Map<String, dynamic>?;
      final incident = event?['incident'] as Map<String, dynamic>?;
      final incidentStatus = incident?['status'] as String?;
      if (watchIncidentTerminal(incidentStatus)) {
        _location.stopTracking();
        unawaited(_emergencyForeground.stop());
      }
      _emit(_state.copyWith(
        incidentId: incident?['id'] as String? ?? _state.incidentId,
        incidentStatus: incidentStatus ?? _state.incidentStatus,
        latitude: (latest?['latitude'] as num?)?.toDouble() ?? _state.latitude,
        longitude:
            (latest?['longitude'] as num?)?.toDouble() ?? _state.longitude,
        offlineQueued: false,
      ));
    } catch (_) {}
  }

  Future<int> flushOfflineQueue() async {
    final deviceId = await _credentials.readDeviceId();
    final deviceSecret = await _credentials.readDeviceSecret();
    if (deviceId == null || deviceSecret == null) return 0;
    if (_connectivity.activeMode == WatchConnectivityMode.offline) return 0;

    if (!_offlineQueue.isAvailable) return 0;
    final queue = await _offlineQueue.loadQueue();
    if (queue.isEmpty) return 0;

    final pending = queue.where((event) => !event.uploaded).toList();
    if (pending.isEmpty) return 0;

    var uploadedCount = 0;
    final sosEvents = pending.where((e) => e.type == OfflineEventType.sos);
    for (final event in sosEvents) {
      final key = event.idempotencyKey;
      if (key != null && _submittedIdempotencyKeys.contains(key)) {
        uploadedCount += 1;
        continue;
      }
      try {
        await _api.post(WatchApiPaths.sos, body: event.payload);
        if (key != null) _submittedIdempotencyKeys.add(key);
        uploadedCount += 1;
      } catch (_) {
        continue;
      }
    }

    final remaining = pending
        .where((event) =>
            event.type != OfflineEventType.sos ||
            (event.idempotencyKey != null &&
                !_submittedIdempotencyKeys.contains(event.idempotencyKey)))
        .toList();

    if (remaining.isNotEmpty) {
      await _api.post(
        WatchApiPaths.offlineSync(deviceId),
        body: {
          'deviceId': deviceId,
          'deviceSecret': deviceSecret,
          'events': remaining.map((e) => e.toSyncJson()).toList(),
        },
      );
      uploadedCount += remaining.length;
    }

    await _offlineQueue.saveQueue([]);
    if (uploadedCount > 0 && _state.offlineQueued) {
      _emit(_state.copyWith(offlineQueued: false));
      if (!watchIncidentTerminal(_state.incidentStatus) &&
          _state.lifecycle != SosLifecycle.active) {
        await _emergencyForeground.stop();
      }
    }
    return uploadedCount;
  }

  void reset() {
    _holdTimer?.cancel();
    _location.stopTracking();
    unawaited(_emergencyForeground.stop());
    _emit(const SosEventState(lifecycle: SosLifecycle.idle));
  }

  void dispose() {
    _holdTimer?.cancel();
    _stateController.close();
  }
}
