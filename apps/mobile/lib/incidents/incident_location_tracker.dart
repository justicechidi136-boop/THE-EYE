import "dart:async";

import "package:geolocator/geolocator.dart";

import "../contracts/the_eye_api_client.dart";
import "../contracts/the_eye_payloads.dart";
import "../location/location_permission_service.dart";

class IncidentLocationTracker {
  IncidentLocationTracker({required TheEyeApiClient apiClient})
      : _apiClient = apiClient;

  final TheEyeApiClient _apiClient;
  Timer? _timer;
  int _sequence = 0;
  String? _incidentId;
  String? _accessToken;

  bool get isTracking => _timer != null;

  void start({required String incidentId, required String accessToken}) {
    stop();
    _incidentId = incidentId;
    _accessToken = accessToken;
    _sequence = 0;
    unawaited(_sendUpdate());
    _timer = Timer.periodic(const Duration(seconds: 10), (_) {
      unawaited(_sendUpdate());
    });
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
    _incidentId = null;
    _accessToken = null;
    _sequence = 0;
  }

  Future<void> _sendUpdate() async {
    final incidentId = _incidentId;
    final accessToken = _accessToken;
    if (incidentId == null || accessToken == null) return;

    try {
      final position = await _readPosition();
      if (position == null) return;

      final sequence = _sequence++;
      await _apiClient.postIncidentLocation(
        incidentId: incidentId,
        payload: TheEyePayloads.incidentLocationUpdate(
          position: position,
          sequenceNumber: sequence,
        ),
        accessToken: accessToken,
      );
    } catch (_) {
      // Best-effort live stream; caller may surface connectivity elsewhere.
    }
  }

  Future<Position?> _readPosition() async {
    final permission = await Geolocator.checkPermission().timeout(
      kLocationPermissionTimeout,
      onTimeout: () => LocationPermission.denied,
    );
    if (!locationPermissionAllowsRead(permission)) {
      return null;
    }
    if (!await Geolocator.isLocationServiceEnabled()) {
      return null;
    }
    try {
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 8),
        ),
      ).timeout(const Duration(seconds: 8));
    } catch (_) {
      return null;
    }
  }
}
