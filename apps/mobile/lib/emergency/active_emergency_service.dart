import "dart:convert";

import "../contracts/the_eye_api_client.dart";
import "../contracts/the_eye_api_paths.dart";
import "active_emergency_contract.dart";
import "active_emergency_errors.dart";
import "active_emergency_refresh_coordinator.dart";
import "active_emergency_store.dart";

class ActiveEmergencyService {
  ActiveEmergencyService({
    required TheEyeApiClient apiClient,
    ActiveEmergencyStore? store,
    ActiveEmergencyRefreshCoordinator? refreshCoordinator,
  })  : _apiClient = apiClient,
        _store = store ?? ActiveEmergencyStore(),
        _refreshCoordinator = refreshCoordinator ?? ActiveEmergencyRefreshCoordinator();

  final TheEyeApiClient _apiClient;
  final ActiveEmergencyStore _store;
  final ActiveEmergencyRefreshCoordinator _refreshCoordinator;

  ActiveEmergencyRefreshCoordinator get refreshCoordinator => _refreshCoordinator;

  Future<List<ActiveIncidentReference>> listActiveReferences() =>
      _store.readReferences();

  Future<ActiveEmergencyContract?> fetchActiveEmergencyContract(
    String incidentId,
    String accessToken, {
    bool silent = false,
  }) async {
    final response = await _apiClient.getJson(
      TheEyeApiPaths.incidentActiveEmergency(incidentId),
      accessToken: accessToken,
    );
    if (response.statusCode == 404) {
      throw ActiveEmergencyContractException(
        ActiveEmergencyErrorCode.unauthorized,
        "Incident not found or outside your scope",
      );
    }
    if (response.statusCode >= 500) {
      throw ActiveEmergencyContractException(
        ActiveEmergencyErrorCode.contractUnavailable,
        "Active emergency unavailable (${response.statusCode})",
      );
    }
    if (response.statusCode >= 400) {
      throw ActiveEmergencyContractException(
        ActiveEmergencyErrorCode.unauthorized,
        "Unable to access active emergency (${response.statusCode})",
      );
    }

    final json = jsonDecode(response.body) as Map<String, dynamic>;
    final contract = ActiveEmergencyContract.fromJson(json);
    await _store.activateIncident(incidentId, silent: silent);
    await _store.updateReference(
      ActiveIncidentReference(
        incidentId: incidentId,
        activatedAt: DateTime.now().toUtc(),
        lastKnownStatus: contract.status,
        statusVersion: contract.statusVersion,
        lastRefreshedAt: DateTime.now().toUtc(),
        silent: silent,
      ),
    );
    if (contract.isTerminal) {
      await _store.removeIncident(incidentId);
    }
    return contract;
  }

  Future<ActiveEmergencySnapshot> refreshIncident(
    String incidentId,
    String accessToken, {
    bool silent = false,
    int? expectedGeneration,
    ActiveEmergencyActiveContract? currentActive,
  }) async {
    final generation = expectedGeneration ?? _refreshCoordinator.beginRefresh();
    final contract = await fetchActiveEmergencyContract(
      incidentId,
      accessToken,
      silent: silent,
    );
    if (contract == null) {
      throw ActiveEmergencyContractException(
        ActiveEmergencyErrorCode.contractUnavailable,
        "Empty active emergency response",
      );
    }

    if (contract is ActiveEmergencyActiveContract &&
        currentActive != null &&
        !_refreshCoordinator.shouldAccept(
          generation: generation,
          incomingStatusVersion: contract.statusVersion,
          incomingUpdatedAt: contract.lastUpdatedAt,
          currentStatusVersion: currentActive.statusVersion,
          currentUpdatedAt: currentActive.lastUpdatedAt,
        )) {
      throw ActiveEmergencyContractException(
        ActiveEmergencyErrorCode.staleActionConflict,
        "Stale active emergency response ignored",
      );
    }

    return ActiveEmergencySnapshot.fromContract(contract, silent: silent);
  }

  Future<ActiveEmergencySnapshot?> restoreActiveEmergency(
    String accessToken,
  ) async {
    final incidentId = await _store.readActiveIncidentId();
    if (incidentId == null || incidentId.isEmpty) return null;
    final silent = await _store.readSilentModeFor(incidentId);
    try {
      return refreshIncident(incidentId, accessToken, silent: silent);
    } catch (_) {
      return null;
    }
  }

  Future<void> activateIncident(String incidentId, {bool silent = false}) {
    return _store.activateIncident(incidentId, silent: silent);
  }

  Future<void> clearActiveIncident([String? incidentId]) async {
    if (incidentId == null) {
      await _store.clearAll();
      return;
    }
    await _store.removeIncident(incidentId);
  }

  Future<ActiveEmergencyContract> cancelIncident(
    String incidentId,
    String accessToken,
    String reason,
  ) async {
    final response = await _apiClient.postJson(
      TheEyeApiPaths.incidentCancel(incidentId),
      {"reason": reason},
      accessToken: accessToken,
    );
    if (response.statusCode >= 400) {
      throw ActiveEmergencyContractException(
        ActiveEmergencyErrorCode.cancellationRejected,
        "Cancellation rejected (${response.statusCode})",
      );
    }
    final contract = await fetchActiveEmergencyContract(incidentId, accessToken);
    if (contract == null) {
      throw ActiveEmergencyContractException(
        ActiveEmergencyErrorCode.contractUnavailable,
        "Cancellation succeeded but refresh failed",
      );
    }
    return contract;
  }

  Future<ActiveEmergencyContract> requestCancellation(
    String incidentId,
    String accessToken,
    String reason,
  ) async {
    final response = await _apiClient.postJson(
      TheEyeApiPaths.incidentRequestCancellation(incidentId),
      {"reason": reason},
      accessToken: accessToken,
    );
    if (response.statusCode >= 400) {
      throw ActiveEmergencyContractException(
        ActiveEmergencyErrorCode.cancellationRejected,
        "Cancellation request rejected (${response.statusCode})",
      );
    }
    final contract = await fetchActiveEmergencyContract(incidentId, accessToken);
    if (contract == null) {
      throw ActiveEmergencyContractException(
        ActiveEmergencyErrorCode.contractUnavailable,
        "Cancellation request succeeded but refresh failed",
      );
    }
    return contract;
  }

  Future<ActiveEmergencyContract> submitReporterStatus(
    String incidentId,
    String accessToken, {
    required String status,
    required String clientActionId,
    String? note,
  }) async {
    final response = await _apiClient.postJson(
      TheEyeApiPaths.incidentReporterStatus(incidentId),
      {
        "status": status,
        "clientActionId": clientActionId,
        if (note != null && note.isNotEmpty) "note": note,
      },
      accessToken: accessToken,
    );
    if (response.statusCode >= 400) {
      throw ActiveEmergencyContractException(
        ActiveEmergencyErrorCode.reporterStatusRejected,
        "Reporter status rejected (${response.statusCode})",
      );
    }
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return ActiveEmergencyContract.fromJson(json);
  }
}
