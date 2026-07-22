import "dart:async";

import "package:geolocator/geolocator.dart";

import "../contracts/the_eye_api_client.dart";
import "../contracts/the_eye_payloads.dart";

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
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );
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
}
