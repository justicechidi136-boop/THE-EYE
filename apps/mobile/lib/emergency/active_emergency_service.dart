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
        _refreshCoordinator =
            refreshCoordinator ?? ActiveEmergencyRefreshCoordinator();

  final TheEyeApiClient _apiClient;
  final ActiveEmergencyStore _store;
  final ActiveEmergencyRefreshCoordinator _refreshCoordinator;

  ActiveEmergencyRefreshCoordinator get refreshCoordinator =>
      _refreshCoordinator;

  Future<List<ActiveIncidentReference>> listActiveReferences() =>
      _store.readReferences();

  Future<List<ActiveEmergencySnapshot>> listActiveEmergencySnapshots(
    String accessToken,
  ) async {
    final references = await _store.readReferences();
    final silentByIncident = {
      for (final reference in references)
        reference.incidentId: reference.silent,
    };
    final rows = await _listAllAuthorizedIncidents(accessToken);
    final snapshots = <ActiveEmergencySnapshot>[];
    for (final row in rows) {
      final incidentId = row["id"]?.toString().trim() ?? "";
      final status = row["status"]?.toString().trim() ?? "";
      if (incidentId.isEmpty || !_activeIncidentStatuses.contains(status)) {
        continue;
      }
      final silent = silentByIncident[incidentId] ?? false;
      try {
        final contract = await fetchActiveEmergencyContract(
          incidentId,
          accessToken,
          silent: silent,
        );
        if (contract is ActiveEmergencyActiveContract) {
          snapshots.add(
            ActiveEmergencySnapshot.fromContract(
              contract,
              silent: silent,
            ),
          );
        }
      } catch (_) {
        snapshots.add(
          ActiveEmergencySnapshot(
            incidentId: incidentId,
            status: status,
            title: row["title"]?.toString() ?? "Emergency",
            type: row["type"]?.toString() ?? "Emergency",
            agencyName: row["assignedAgencyId"]?.toString() ?? "",
            timeline: const [],
            reportedAt: DateTime.tryParse(
              row["submittedAt"]?.toString() ??
                  row["createdAt"]?.toString() ??
                  "",
            ),
            silent: silent,
          ),
        );
      }
    }
    return snapshots;
  }

  static const _activeIncidentStatuses = {
    "Submitted",
    "Received",
    "Verifying",
    "Verified",
    "Assigned",
    "Responding",
    "UnderControl",
    "CancellationRequested",
  };

  Future<List<Map<String, dynamic>>> _listAllAuthorizedIncidents(
    String accessToken,
  ) async {
    final rows = <Map<String, dynamic>>[];
    final seenCursors = <String>{};
    String? cursor;
    do {
      final response = await _apiClient.getJson(
        TheEyeApiPaths.incidents,
        accessToken: accessToken,
        query: {
          "limit": "100",
          if (cursor != null) "cursor": cursor,
        },
      );
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw StateError("Unable to load active emergencies");
      }
      final decoded = jsonDecode(response.body);
      if (decoded is! Map || decoded["data"] is! List) {
        throw const FormatException("Malformed incident list response");
      }
      rows.addAll(
        (decoded["data"] as List)
            .whereType<Map>()
            .map((row) => Map<String, dynamic>.from(row)),
      );
      final hasMore = decoded["hasMore"] == true;
      final nextCursor = decoded["nextCursor"]?.toString().trim();
      if (!hasMore || nextCursor == null || nextCursor.isEmpty) break;
      if (!seenCursors.add(nextCursor)) {
        throw StateError("Incident pagination cursor repeated");
      }
      cursor = nextCursor;
    } while (true);
    return rows;
  }

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
    String reason, {
    String? reasonCode,
    String? reasonText,
  }) async {
    final response = await _apiClient.postJson(
      TheEyeApiPaths.incidentCancel(incidentId),
      {
        "reason": reason,
        if (reasonCode != null) "reasonCode": reasonCode,
        if (reasonText != null) "reasonText": reasonText,
      },
      accessToken: accessToken,
    );
    if (response.statusCode >= 400) {
      throw ActiveEmergencyContractException(
        ActiveEmergencyErrorCode.cancellationRejected,
        "Cancellation rejected (${response.statusCode})",
      );
    }
    final contract =
        await fetchActiveEmergencyContract(incidentId, accessToken);
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
    String reason, {
    String? reasonCode,
    String? reasonText,
  }) async {
    final response = await _apiClient.postJson(
      TheEyeApiPaths.incidentRequestCancellation(incidentId),
      {
        "reason": reason,
        if (reasonCode != null) "reasonCode": reasonCode,
        if (reasonText != null) "reasonText": reasonText,
      },
      accessToken: accessToken,
    );
    if (response.statusCode >= 400) {
      throw ActiveEmergencyContractException(
        ActiveEmergencyErrorCode.cancellationRejected,
        "Cancellation request rejected (${response.statusCode})",
      );
    }
    final contract =
        await fetchActiveEmergencyContract(incidentId, accessToken);
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
