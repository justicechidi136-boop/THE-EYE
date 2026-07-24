import "dart:async";

import "package:geolocator/geolocator.dart";

import "../contracts/the_eye_api_client.dart";
import "../contracts/the_eye_payloads.dart";
import "emergency_foreground_service.dart";
import "emergency_location_fix.dart";
import "location_types.dart";

typedef EmergencyLocationListener = void Function(EmergencyLocationFix fix);

EmergencyLocationCoordinator sharedEmergencyLocationCoordinator({
  GeolocatorPlatform? geolocator,
}) {
  if (geolocator != null) {
    _sharedCoordinator?.stopTracking();
    _sharedCoordinator = EmergencyLocationCoordinator(geolocator: geolocator);
    return _sharedCoordinator!;
  }
  return _sharedCoordinator ??= EmergencyLocationCoordinator();
}

EmergencyLocationCoordinator? _sharedCoordinator;

void resetSharedEmergencyLocationCoordinator() {
  _sharedCoordinator?.stopTracking();
  _sharedCoordinator = null;
}

/// Single coordinator for permission, acquisition, retry, and active tracking.
class EmergencyLocationCoordinator {
  EmergencyLocationCoordinator({GeolocatorPlatform? geolocator})
      : _platform = geolocator ?? GeolocatorPlatform.instance;

  final GeolocatorPlatform _platform;
  final Map<String, Future<dynamic>> _singleFlight = {};
  final List<EmergencyLocationListener> _listeners = [];

  EmergencyLocationFix? _lastFix;
  Future<void>? _backgroundRetry;
  Timer? _streamTimer;
  Timer? _retryTimer;
  int _retryAttempt = 0;
  int _sequence = 0;
  String? _activeIncidentId;
  String? _accessToken;
  String? _liveVideoSessionId;
  TheEyeApiClient? _apiClient;
  bool _tracking = false;

  EmergencyLocationFix? get lastFix => _lastFix;
  bool get isTracking => _tracking;

  void addListener(EmergencyLocationListener listener) {
    _listeners.add(listener);
  }

  void removeListener(EmergencyLocationListener listener) {
    _listeners.remove(listener);
  }

  /// Returns cached fix immediately, or pending access without waiting for fresh GPS.
  /// Fresh acquisition continues via [startTracking] after the incident exists.
  Future<LocationAccessResult> resolveImmediateEmergencyAccess({
    bool requestIfDenied = true,
  }) {
    return _singleFlightGuard("resolve-immediate", () async {
      final requestId = _newRequestId();
      final permissionState = await resolveLocationPermissionState(
        requestIfDenied: requestIfDenied,
        geolocator: _platform,
      );

      if (permissionState == LocationPermissionState.serviceDisabled) {
        return LocationAccessResult(
          state: permissionState,
          message: permissionStateMessage(permissionState),
          recoveryAction: LocationRecoveryAction.openLocationSettings,
          errorCode: LocationErrorCode.serviceDisabled,
        );
      }
      if (permissionState == LocationPermissionState.denied) {
        return LocationAccessResult(
          state: permissionState,
          message: permissionStateMessage(permissionState),
          recoveryAction: LocationRecoveryAction.retry,
          errorCode: LocationErrorCode.permissionDenied,
        );
      }
      if (permissionState == LocationPermissionState.deniedPermanently) {
        return LocationAccessResult(
          state: permissionState,
          message: permissionStateMessage(permissionState),
          recoveryAction: LocationRecoveryAction.openAppSettings,
          errorCode: LocationErrorCode.permanentlyDenied,
        );
      }

      final cached = await _readCachedFix(
        permissionState: permissionState,
        requestId: requestId,
      );
      if (cached != null && cached.isUsableForSubmission) {
        _publishFix(cached);
        return _accessFromFix(cached, permissionState);
      }

      return LocationAccessResult(
        state: LocationPermissionState.timedOut,
        message: emergencyLocationRetryMessage(
          const LocationAccessResult(state: LocationPermissionState.timedOut),
        ),
        recoveryAction: LocationRecoveryAction.retry,
        errorCode: LocationErrorCode.acquisitionTimeout,
      );
    });
  }

  /// Bounded acquisition for SOS flows that may wait briefly for a fresh fix.
  Future<LocationAccessResult> acquireForEmergencySubmission({
    Duration submissionDeadline = EmergencyLocationPolicy.submissionDeadline,
    bool requestIfDenied = true,
  }) {
    return _singleFlightGuard(
      "acquire-emergency",
      () => _runAcquireForEmergencySubmission(
        submissionDeadline: submissionDeadline,
        requestIfDenied: requestIfDenied,
      ),
    );
  }

  Future<LocationAccessResult> _runAcquireForEmergencySubmission({
    required Duration submissionDeadline,
    required bool requestIfDenied,
  }) async {
    final requestId = _newRequestId();
    final permissionState = await resolveLocationPermissionState(
      requestIfDenied: requestIfDenied,
      geolocator: _platform,
    );

    if (permissionState == LocationPermissionState.serviceDisabled) {
      return LocationAccessResult(
        state: permissionState,
        message: permissionStateMessage(permissionState),
        recoveryAction: LocationRecoveryAction.openLocationSettings,
        errorCode: LocationErrorCode.serviceDisabled,
      );
    }
    if (permissionState == LocationPermissionState.denied) {
      return LocationAccessResult(
        state: permissionState,
        message: permissionStateMessage(permissionState),
        recoveryAction: LocationRecoveryAction.retry,
        errorCode: LocationErrorCode.permissionDenied,
      );
    }
    if (permissionState == LocationPermissionState.deniedPermanently) {
      return LocationAccessResult(
        state: permissionState,
        message: permissionStateMessage(permissionState),
        recoveryAction: LocationRecoveryAction.openAppSettings,
        errorCode: LocationErrorCode.permanentlyDenied,
      );
    }
    if (permissionState == LocationPermissionState.restricted) {
      return LocationAccessResult(
        state: permissionState,
        message: permissionStateMessage(permissionState),
        recoveryAction: LocationRecoveryAction.openAppSettings,
        errorCode: LocationErrorCode.permissionDenied,
      );
    }

    final cached = await _readCachedFix(
      permissionState: permissionState,
      requestId: requestId,
    );
    if (cached != null && cached.isUsableForSubmission) {
      _publishFix(cached);
      unawaited(_continueFreshAcquisitionAfterCached(
        permissionState: permissionState,
        requestId: requestId,
      ));
      return _accessFromFix(cached, permissionState);
    }

    final startedAt = DateTime.now();
    final freshFuture = _acquireFreshFix(
      permissionState: permissionState,
      balancedTimeout: EmergencyLocationPolicy.balancedTimeout,
      highAccuracyTimeout: EmergencyLocationPolicy.highAccuracyTimeout,
      deadline: submissionDeadline,
      startedAt: startedAt,
      requestId: requestId,
    );
    final fresh = await freshFuture.timeout(
      submissionDeadline,
      onTimeout: () => null,
    );
    if (fresh != null) {
      _publishFix(fresh);
      return _accessFromFix(fresh, permissionState);
    }

    return LocationAccessResult(
      state: LocationPermissionState.timedOut,
      message: emergencyLocationRetryMessage(
        const LocationAccessResult(state: LocationPermissionState.timedOut),
      ),
      recoveryAction: LocationRecoveryAction.retry,
      errorCode: LocationErrorCode.acquisitionTimeout,
    );
  }

  Future<LocationAccessResult> resolveNearbyAccess({
    Duration timeout = kEmergencyLocationTimeout,
    bool requestIfDenied = true,
  }) {
    return acquireForEmergencySubmission(
      submissionDeadline: timeout,
      requestIfDenied: requestIfDenied,
    );
  }

  /// Fresh fix for non-emergency flows that require live GPS (compose reports).
  Future<LocationCaptureOutcome> captureFreshOutcome({
    LocationAccuracy accuracy = LocationAccuracy.high,
    Duration timeout = kLocationCaptureTimeout,
    bool requestIfDenied = true,
  }) {
    return _singleFlightGuard(
      "capture-fresh",
      () => _runCaptureFreshOutcome(
        accuracy: accuracy,
        timeout: timeout,
        requestIfDenied: requestIfDenied,
      ),
    );
  }

  Future<LocationCaptureOutcome> _runCaptureFreshOutcome({
    required LocationAccuracy accuracy,
    required Duration timeout,
    required bool requestIfDenied,
  }) async {
    final permissionState = await resolveLocationPermissionState(
      requestIfDenied: requestIfDenied,
      geolocator: _platform,
    );
    if (permissionState == LocationPermissionState.serviceDisabled) {
      return LocationCaptureOutcome(
        result: LocationCaptureResult.serviceDisabled,
      );
    }
    if (permissionState == LocationPermissionState.denied) {
      return LocationCaptureOutcome(result: LocationCaptureResult.denied);
    }
    if (permissionState == LocationPermissionState.deniedPermanently ||
        permissionState == LocationPermissionState.restricted) {
      return LocationCaptureOutcome(
        result: LocationCaptureResult.deniedForever,
      );
    }

    final fresh = await _acquireFreshFix(
      permissionState: permissionState,
      balancedTimeout: timeout < EmergencyLocationPolicy.balancedTimeout
          ? timeout
          : EmergencyLocationPolicy.balancedTimeout,
      highAccuracyTimeout: timeout,
      deadline: timeout,
      startedAt: DateTime.now(),
      requestId: _newRequestId(),
      accuracy: accuracy,
    );
    if (fresh != null) {
      return LocationCaptureOutcome(
        position: fresh.toPosition(),
        result: LocationCaptureResult.granted,
      );
    }
    return LocationCaptureOutcome(result: LocationCaptureResult.timeout);
  }

  void startTracking({
    required String incidentId,
    required String accessToken,
    required TheEyeApiClient apiClient,
    String? liveVideoSessionId,
  }) {
    stopTracking();
    _activeIncidentId = incidentId;
    _accessToken = accessToken;
    _apiClient = apiClient;
    _liveVideoSessionId = liveVideoSessionId;
    _tracking = true;
    _retryAttempt = 0;
    unawaited(EmergencyForegroundService.start(incidentId: incidentId));
    unawaited(_sendTrackingUpdate(force: true));
    _scheduleRetry(delay: EmergencyLocationPolicy.retryDelays.first);
    _streamTimer?.cancel();
    _streamTimer = Timer.periodic(EmergencyLocationPolicy.streamInterval, (_) {
      unawaited(_sendTrackingUpdate());
    });
  }

  void setLiveVideoSessionId(String? sessionId) {
    _liveVideoSessionId = sessionId;
  }

  void stopTracking() {
    _streamTimer?.cancel();
    _streamTimer = null;
    _retryTimer?.cancel();
    _retryTimer = null;
    _backgroundRetry = null;
    _tracking = false;
    _activeIncidentId = null;
    _accessToken = null;
    _liveVideoSessionId = null;
    _apiClient = null;
    _retryAttempt = 0;
    _sequence = 0;
    unawaited(EmergencyForegroundService.stop());
  }

  Future<Position?> acquireFreshPosition({
    LocationAccuracy accuracy = LocationAccuracy.high,
    Duration timeout = EmergencyLocationPolicy.trackerSampleTimeout,
  }) async {
    final fix = await _acquireFreshFix(
      permissionState: LocationPermissionState.grantedPrecise,
      balancedTimeout: timeout,
      highAccuracyTimeout: timeout,
      deadline: timeout,
      startedAt: DateTime.now(),
      requestId: _newRequestId(),
      accuracy: accuracy,
    );
    return fix?.toPosition();
  }

  Future<void> _continueFreshAcquisitionAfterCached({
    required LocationPermissionState permissionState,
    required String requestId,
  }) async {
    if (_backgroundRetry != null) return;
    _backgroundRetry = _acquireFreshFix(
      permissionState: permissionState,
      balancedTimeout: EmergencyLocationPolicy.balancedTimeout,
      highAccuracyTimeout: EmergencyLocationPolicy.highAccuracyTimeout,
      deadline: EmergencyLocationPolicy.highAccuracyTimeout,
      startedAt: DateTime.now(),
      requestId: requestId,
    ).then((fix) {
      if (fix != null) _publishFix(fix);
    }).whenComplete(() {
      _backgroundRetry = null;
    });
    await _backgroundRetry;
  }

  Future<EmergencyLocationFix?> _acquireFreshFix({
    required LocationPermissionState permissionState,
    required Duration balancedTimeout,
    required Duration highAccuracyTimeout,
    required Duration deadline,
    required DateTime startedAt,
    required String requestId,
    LocationAccuracy accuracy = LocationAccuracy.high,
  }) async {
    if (!await _platform.isLocationServiceEnabled()) {
      return null;
    }

    Future<EmergencyLocationFix?> tryRead(
      LocationAccuracy readAccuracy,
      Duration timeout,
    ) async {
      try {
        final position = await _platform
            .getCurrentPosition(
              locationSettings: LocationSettings(
                accuracy: readAccuracy,
                timeLimit: timeout,
              ),
            )
            .timeout(timeout);
        return evaluatePosition(
          position: position,
          source: EmergencyLocationSource.freshGps,
          isCached: false,
          permissionState: permissionState,
          serviceEnabled: true,
          requestId: requestId,
        );
      } catch (_) {
        return null;
      }
    }

    final balanced = await tryRead(
      LocationAccuracy.medium,
      balancedTimeout,
    );
    if (balanced != null && balanced.isUsableForSubmission) {
      return balanced;
    }

    final elapsed = DateTime.now().difference(startedAt);
    final remaining = deadline - elapsed;
    if (remaining <= Duration.zero) {
      return balanced;
    }

    final highAccuracyRemaining =
        remaining < highAccuracyTimeout ? remaining : highAccuracyTimeout;
    final highAccuracy = await tryRead(accuracy, highAccuracyRemaining);
    return highAccuracy ?? balanced;
  }

  Future<EmergencyLocationFix?> _readCachedFix({
    required LocationPermissionState permissionState,
    required String requestId,
  }) async {
    try {
      final last = await _platform.getLastKnownPosition().timeout(
            const Duration(seconds: 2),
            onTimeout: () => null,
          );
      if (last == null) return null;
      return evaluatePosition(
        position: last,
        source: EmergencyLocationSource.cachedDevice,
        isCached: true,
        permissionState: permissionState,
        serviceEnabled: true,
        requestId: requestId,
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> _sendTrackingUpdate({bool force = false}) async {
    if (!_tracking) return;
    final incidentId = _activeIncidentId;
    final token = _accessToken;
    final api = _apiClient;
    if (incidentId == null || token == null || api == null) return;

    final permission = await _platform.checkPermission().timeout(
          kLocationPermissionTimeout,
          onTimeout: () => LocationPermission.denied,
        );
    if (!locationPermissionAllowsRead(permission)) {
      _scheduleRetry(delay: EmergencyLocationPolicy.retryDelays.first);
      return;
    }
    if (!await _platform.isLocationServiceEnabled()) {
      _scheduleRetry(delay: EmergencyLocationPolicy.retryDelays.first);
      return;
    }

    final fix = await _acquireFreshFix(
      permissionState: mapPermissionToState(permission),
      balancedTimeout: EmergencyLocationPolicy.trackerSampleTimeout,
      highAccuracyTimeout: EmergencyLocationPolicy.trackerSampleTimeout,
      deadline: EmergencyLocationPolicy.trackerSampleTimeout,
      startedAt: DateTime.now(),
      requestId: _newRequestId(),
    );
    if (fix == null) {
      if (!force) _scheduleNextRetry();
      return;
    }

    if (_lastFix != null &&
        _lastFix!.latitude == fix.latitude &&
        _lastFix!.longitude == fix.longitude &&
        fix.sequence == _lastFix!.sequence) {
      return;
    }

    final sequence = _sequence++;
    final enriched = EmergencyLocationFix(
      latitude: fix.latitude,
      longitude: fix.longitude,
      accuracyMeters: fix.accuracyMeters,
      capturedAt: fix.capturedAt,
      receivedAt: fix.receivedAt,
      source: fix.source,
      isCached: fix.isCached,
      ageSeconds: fix.ageSeconds,
      sequence: sequence,
      speed: fix.speed,
      heading: fix.heading,
      provider: fix.provider,
      quality: fix.quality,
      permissionState: fix.permissionState,
      serviceEnabled: fix.serviceEnabled,
      requestId: fix.requestId,
    );
    _publishFix(enriched);

    try {
      await api.postIncidentLocation(
        incidentId: incidentId,
        payload: TheEyePayloads.incidentLocationUpdate(
          position: enriched.toPosition(),
          sequenceNumber: sequence,
          source: mapSourceToApi(enriched.source),
          quality: mapQualityToApi(enriched.quality),
          isCached: enriched.isCached,
          ageSeconds: enriched.ageSeconds,
        ),
        accessToken: token,
      );
      final liveSessionId = _liveVideoSessionId;
      if (liveSessionId != null && liveSessionId.isNotEmpty) {
        await api.postLiveVideoLocation(
          sessionId: liveSessionId,
          payload: TheEyePayloads.liveVideoLocationUpdate(
            position: enriched.toPosition(),
          ),
          accessToken: token,
        );
      }
      _retryAttempt = 0;
    } catch (_) {
      _scheduleNextRetry();
    }
  }

  void _scheduleRetry({required Duration delay}) {
    _retryTimer?.cancel();
    _retryTimer = Timer(delay, () {
      unawaited(_sendTrackingUpdate());
    });
  }

  void _scheduleNextRetry() {
    if (!_tracking) return;
    final delays = EmergencyLocationPolicy.retryDelays;
    final delay = _retryAttempt < delays.length
        ? delays[_retryAttempt]
        : EmergencyLocationPolicy.activeRetryInterval;
    _retryAttempt++;
    _scheduleRetry(delay: delay);
  }

  LocationAccessResult _accessFromFix(
    EmergencyLocationFix fix,
    LocationPermissionState permissionState,
  ) {
    final position = fix.toPosition();
    final isCached = fix.isCached;
    return LocationAccessResult(
      state: permissionState,
      position: position,
      source: isCached ? LocationSource.cachedMobile : LocationSource.mobileGps,
      isCached: isCached,
      ageSeconds: fix.ageSeconds,
      message: isCached
          ? cachedLocationUserMessage(fix.ageSeconds)
          : lowAccuracyLocationMessage(fix.quality),
      recoveryAction: LocationRecoveryAction.retry,
      quality: fix.quality,
      requestId: fix.requestId,
    );
  }

  void _publishFix(EmergencyLocationFix fix) {
    _lastFix = fix;
    for (final listener in List<EmergencyLocationListener>.from(_listeners)) {
      listener(fix);
    }
  }

  Future<T> _singleFlightGuard<T>(String key, Future<T> Function() run) {
    final existing = _singleFlight[key];
    if (existing != null) {
      return existing as Future<T>;
    }
    final future = run();
    _singleFlight[key] = future;
    unawaited(
      future.whenComplete(() {
        if (_singleFlight[key] == future) {
          _singleFlight.remove(key);
        }
      }),
    );
    return future;
  }

  String _newRequestId() =>
      "loc-${DateTime.now().microsecondsSinceEpoch}-${_sequence}";
}
