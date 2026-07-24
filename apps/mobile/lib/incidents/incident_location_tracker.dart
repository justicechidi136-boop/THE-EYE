import "dart:async";

import "../contracts/the_eye_api_client.dart";
import "../location/emergency_location_coordinator.dart";

/// Legacy tracker wrapper — delegates to [EmergencyLocationCoordinator].
class IncidentLocationTracker {
  IncidentLocationTracker({required TheEyeApiClient apiClient})
      : _apiClient = apiClient;

  final TheEyeApiClient _apiClient;

  bool get isTracking => sharedEmergencyLocationCoordinator().isTracking;

  void start({required String incidentId, required String accessToken}) {
    sharedEmergencyLocationCoordinator().startTracking(
      incidentId: incidentId,
      accessToken: accessToken,
      apiClient: _apiClient,
    );
  }

  void stop() {
    sharedEmergencyLocationCoordinator().stopTracking();
  }
}
