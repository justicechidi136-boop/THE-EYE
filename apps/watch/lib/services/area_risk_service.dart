import 'dart:async';

import 'package:flutter/foundation.dart';

import '../api/watch_api_client.dart';
import '../api/watch_api_paths.dart';
import '../models/watch_area_risk.dart';
import '../storage/secure_credential_store.dart';
import 'location_service.dart';

class AreaRiskService {
  AreaRiskService({
    required WatchApiClient api,
    required SecureCredentialStore credentials,
    required LocationService location,
    this.refreshInterval = const Duration(minutes: 5),
  })  : _api = api,
        _credentials = credentials,
        _location = location;

  final WatchApiClient _api;
  final SecureCredentialStore _credentials;
  final LocationService _location;
  final Duration refreshInterval;
  final ValueNotifier<WatchAreaRiskStatus> status =
      ValueNotifier<WatchAreaRiskStatus>(WatchAreaRiskStatus.unknown);
  Timer? _timer;
  bool _refreshing = false;
  bool _disposed = false;

  void start() {
    if (_disposed) return;
    _timer?.cancel();
    unawaited(refresh());
    _timer = Timer.periodic(refreshInterval, (_) => unawaited(refresh()));
  }

  Future<void> refresh() async {
    if (_refreshing || _disposed) return;
    _refreshing = true;
    try {
      final accessToken = await _credentials.readAccessToken();
      if (accessToken == null || accessToken.isEmpty) return;
      final position =
          await _location.getCurrentPosition(requestIfDenied: false);
      if (position == null) return;
      _api.accessToken = accessToken;
      final response = await _api.get(
        WatchApiPaths.dangerAreaRisk(position.latitude, position.longitude),
      );
      final data = response['data'];
      if (!_disposed && data is Map<String, dynamic>) {
        status.value = WatchAreaRiskStatus.fromJson(data);
      }
    } catch (_) {
      // Preserve the last trusted classification while temporarily offline.
    } finally {
      _refreshing = false;
    }
  }

  void dispose() {
    if (_disposed) return;
    _disposed = true;
    _timer?.cancel();
    status.dispose();
  }
}
