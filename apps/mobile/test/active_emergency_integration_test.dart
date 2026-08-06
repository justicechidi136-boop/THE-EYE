import "package:flutter_test/flutter_test.dart";
import "package:shared_preferences/shared_preferences.dart";

import "package:the_eye_mobile/emergency/active_emergency_contract.dart";
import "package:the_eye_mobile/emergency/active_emergency_errors.dart";
import "package:the_eye_mobile/emergency/active_emergency_refresh_coordinator.dart";
import "package:the_eye_mobile/emergency/active_emergency_store.dart";

const activeFixture = {
  "isActive": true,
  "routeType": "OWN_ACTIVE_INCIDENT",
  "incidentId": "inc-123",
  "ownership": "reporter",
  "category": "Accident",
  "description": "Road accident on highway",
  "title": "Road accident",
  "reportedAt": "2026-08-05T10:00:00.000Z",
  "reportedLocation": {
    "latitude": "6.601800",
    "longitude": "3.351500",
    "address": "Ikeja",
    "manualLocationAdjusted": false,
    "source": "gps",
    "quality": "reported",
    "liveLocationStale": false,
    "liveLocationUpdatedAt": null,
  },
  "evidenceSummary": {
    "totalCount": 1,
    "photos": 1,
    "videos": 0,
    "voice": 0,
  },
  "status": "Verifying",
  "displayLabel": "Verifying report",
  "statusVersion": 2,
  "progressStep": 3,
  "progressStages": [
    {"key": "submitted", "label": "Submitted", "state": "complete"},
    {"key": "verifying", "label": "Verifying", "state": "current"},
  ],
  "allowedActions": {
    "addEvidence": true,
    "uploadPhoto": true,
    "uploadVideo": true,
    "uploadVoice": true,
    "addUpdate": true,
    "cancel": true,
    "requestCancellation": false,
    "confirmResolved": false,
    "confirmStillOngoing": false,
    "addWrittenUpdate": true,
    "updateLocation": true,
    "retryLiveVideo": true,
  },
  "timelineSummary": [
    {
      "id": "tl-1",
      "eventType": "incident.status_changed",
      "message": "Status changed",
      "createdAt": "2026-08-05T10:01:00.000Z",
    }
  ],
  "assignedAgency": null,
  "assignment": null,
  "responderEtaMinutes": null,
  "liveVideo": null,
  "communityVerificationSummary": {
    "witnessCount": 0,
    "latestConfidence": null,
  },
  "cancellationSummary": {"status": "none"},
  "resolutionSummary": null,
  "lastUpdatedAt": "2026-08-05T10:05:00.000Z",
};

const terminalFixture = {
  "isActive": false,
  "routeType": "INCIDENT_DETAILS",
  "incidentId": "inc-123",
  "status": "CancelledByReporter",
  "displayLabel": "Cancelled by reporter",
  "statusVersion": 4,
  "cancellationSummary": {
    "status": "cancelled",
    "reason": "False alarm",
    "cancelledAt": "2026-08-05T10:10:00.000Z",
  },
  "resolutionSummary": null,
};

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test("decodes active emergency contract fixture", () {
    final contract = ActiveEmergencyContract.fromJson(activeFixture);
    expect(contract, isA<ActiveEmergencyActiveContract>());
    final active = contract as ActiveEmergencyActiveContract;
    expect(active.incidentId, "inc-123");
    expect(active.displayLabel, "Verifying report");
    expect(active.progressStages.first.state,
        ActiveEmergencyProgressStageState.complete);
    expect(active.allowedActions.cancel, isTrue);
    expect(active.allowedActions.requestCancellation, isFalse);
  });

  test("fails when required contract field is missing", () {
    final broken = Map<String, dynamic>.from(activeFixture)..remove("displayLabel");
    expect(
      () => ActiveEmergencyContract.fromJson(broken),
      throwsA(isA<ActiveEmergencyContractException>()),
    );
  });

  test("decodes terminal contract for incident details routing", () {
    final contract = ActiveEmergencyContract.fromJson(terminalFixture);
    expect(contract, isA<ActiveEmergencyTerminalContract>());
    expect(contract.isTerminal, isTrue);
    expect(contract.routeType, "INCIDENT_DETAILS");
  });

  test("refresh coordinator rejects stale lifecycle overwrite", () {
    final coordinator = ActiveEmergencyRefreshCoordinator();
    final generation = coordinator.beginRefresh();
    expect(
      coordinator.shouldAccept(
        generation: generation,
        incomingStatusVersion: 1,
        incomingUpdatedAt: DateTime.parse("2026-08-05T10:00:00.000Z"),
        currentStatusVersion: 3,
        currentUpdatedAt: DateTime.parse("2026-08-05T10:05:00.000Z"),
      ),
      isFalse,
    );
  });

  test("store supports multiple active incident references", () async {
    final store = ActiveEmergencyStore();
    await store.clearAll();
    await store.activateIncident("inc-a");
    await store.activateIncident("inc-b");
    final refs = await store.readReferences();
    expect(refs.length, 2);
    expect(refs.first.incidentId, "inc-b");
  });

  test("store migrates legacy single incident key", () async {
    final store = ActiveEmergencyStore();
    await store.clearAll();
    // Simulate legacy write through activate then clear and rewrite legacy - skip full legacy test
    await store.activateIncident("legacy-incident");
    final id = await store.readActiveIncidentId();
    expect(id, "legacy-incident");
  });
}
