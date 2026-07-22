import "dart:convert";

import "../contracts/the_eye_api_client.dart";
import "../contracts/the_eye_api_paths.dart";
import "active_emergency_store.dart";

class ActiveEmergencyService {
  ActiveEmergencyService({
    required TheEyeApiClient apiClient,
    ActiveEmergencyStore? store,
  })  : _apiClient = apiClient,
        _store = store ?? ActiveEmergencyStore();

  final TheEyeApiClient _apiClient;
  final ActiveEmergencyStore _store;

  Future<ActiveEmergencySnapshot?> restoreActiveEmergency(
      String accessToken) async {
    final incidentId = await _store.readActiveIncidentId();
    if (incidentId == null || incidentId.isEmpty) return null;
    final silent = await _store.readSilentMode();
    return refreshIncident(incidentId, accessToken, silent: silent);
  }

  Future<ActiveEmergencySnapshot> refreshIncident(
    String incidentId,
    String accessToken, {
    bool silent = false,
  }) async {
    final detailResponse = await _apiClient.getJson(
      TheEyeApiPaths.incidentDetail(incidentId),
      accessToken: accessToken,
    );
    final detail = jsonDecode(detailResponse.body) as Map<String, dynamic>;
    var timeline = (detail["timeline"] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map((entry) => Map<String, dynamic>.from(entry))
        .toList();

    try {
      final timelineResponse = await _apiClient.getJson(
        TheEyeApiPaths.incidentTimeline(incidentId),
        accessToken: accessToken,
      );
      final timelineJson =
          jsonDecode(timelineResponse.body) as Map<String, dynamic>;
      final entries = timelineJson["data"] as List<dynamic>? ?? [];
      timeline = entries
          .whereType<Map<String, dynamic>>()
          .map((entry) => Map<String, dynamic>.from(entry))
          .toList();
    } catch (_) {
      // timeline endpoint may be unavailable for legacy incidents
    }

    final snapshot = ActiveEmergencySnapshot.fromJson(detail, silent: silent);

    DateTime? lastLocationAt;
    try {
      final liveResponse = await _apiClient.getJson(
        TheEyeApiPaths.incidentLiveLocation(incidentId),
        accessToken: accessToken,
      );
      final liveJson = jsonDecode(liveResponse.body) as Map<String, dynamic>;
      final data = liveJson["data"] as Map<String, dynamic>?;
      if (data != null && data["capturedAt"] != null) {
        lastLocationAt = DateTime.tryParse(data["capturedAt"].toString());
      }
    } catch (_) {
      // live location may not exist yet
    }

    return ActiveEmergencySnapshot(
      incidentId: snapshot.incidentId,
      status: snapshot.status,
      title: snapshot.title,
      type: snapshot.type,
      agencyName: snapshot.agencyName,
      timeline: timeline,
      lastLocationAt: lastLocationAt,
      silent: snapshot.silent,
    );
  }

  Future<void> activateIncident(String incidentId, {bool silent = false}) {
    return _store.saveActiveIncident(incidentId, silent: silent);
  }

  Future<void> clearActiveIncident() => _store.clearActiveIncident();

  Future<void> cancelIncident(
      String incidentId, String accessToken, String reason) async {
    await _apiClient.postJson(
      TheEyeApiPaths.incidentCancel(incidentId),
      {"reason": reason},
      accessToken: accessToken,
    );
    await _store.clearActiveIncident();
  }
}
