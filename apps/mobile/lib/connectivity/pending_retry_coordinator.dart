import "dart:async";
import "dart:math" as math;

import "package:flutter/foundation.dart";

import "../incidents/incident_submission_result.dart";
import "../incidents/incident_submission_service.dart";
import "connectivity_service.dart";
import "retry_log.dart";

typedef AccessTokenProvider = String? Function();
typedef RetrySyncComplete = Future<void> Function(
    List<IncidentSubmissionResult> results);

class PendingRetryCoordinator {
  PendingRetryCoordinator({
    required ConnectivityService connectivity,
    required IncidentSubmissionService submissionService,
    required AccessTokenProvider accessTokenProvider,
    this.initialDelay = const Duration(seconds: 2),
    this.maxDelay = const Duration(minutes: 5),
    this.logSink,
  })  : _connectivity = connectivity,
        _submissionService = submissionService,
        _accessTokenProvider = accessTokenProvider;

  final ConnectivityService _connectivity;
  final IncidentSubmissionService _submissionService;
  final AccessTokenProvider _accessTokenProvider;
  final Duration initialDelay;
  final Duration maxDelay;
  final void Function(String message)? logSink;

  RetrySyncComplete? onSyncComplete;
  int _attempt = 0;
  Timer? _retryTimer;
  bool _syncInProgress = false;
  bool _started = false;

  void start() {
    if (_started) return;
    _started = true;
    _connectivity.addListener(_onConnectivityChanged);
    if (_connectivity.isOnline) {
      unawaited(_runSync(immediate: true));
    }
  }

  void _onConnectivityChanged() {
    if (_connectivity.isOnline) {
      _attempt = 0;
      _retryTimer?.cancel();
      unawaited(_runSync(immediate: true));
      return;
    }
    _retryTimer?.cancel();
  }

  Future<void> triggerManualSync() => _runSync(immediate: true);

  Future<void> _runSync({bool immediate = false}) async {
    if (_syncInProgress || !_connectivity.isOnline) return;
    _syncInProgress = true;
    try {
      final results = await _submissionService.syncPending(
          accessToken: _accessTokenProvider());
      for (final result in results) {
        logRetryResult(
          clientSubmissionId: result.clientSubmissionId ?? "unknown",
          result: result,
          sink: logSink,
        );
      }

      if (onSyncComplete != null) {
        await onSyncComplete!(results);
      }

      final shouldRetry =
          results.any((result) => !result.isSuccess && result.canRetry);
      if (shouldRetry) {
        _scheduleRetry();
      } else {
        _attempt = 0;
      }
    } finally {
      _syncInProgress = false;
    }
  }

  void _scheduleRetry() {
    if (!_connectivity.isOnline || _syncInProgress) return;
    _retryTimer?.cancel();
    final delay = _nextDelay();
    _retryTimer = Timer(delay, () {
      _attempt += 1;
      unawaited(_runSync());
    });
  }

  Duration _nextDelay() {
    final multiplier = math.pow(2, _attempt).toInt();
    final seconds =
        math.min(initialDelay.inSeconds * multiplier, maxDelay.inSeconds);
    return Duration(seconds: seconds);
  }

  void dispose() {
    _retryTimer?.cancel();
    _connectivity.removeListener(_onConnectivityChanged);
  }
}
