import "dart:convert";
import "dart:io";

import "package:connectivity_plus/connectivity_plus.dart";
import "package:flutter_test/flutter_test.dart";
import "package:http/http.dart" as http;
import "package:http/testing.dart";

import "package:the_eye_mobile/connectivity/connectivity_service.dart";
import "package:the_eye_mobile/connectivity/connectivity_state.dart";
import "package:the_eye_mobile/connectivity/network_interface_reader.dart";
import "package:the_eye_mobile/connectivity/pending_retry_coordinator.dart";
import "package:the_eye_mobile/connectivity/retry_log.dart";
import "package:the_eye_mobile/contracts/the_eye_api_client.dart";
import "package:the_eye_mobile/contracts/the_eye_api_paths.dart";
import "package:the_eye_mobile/incidents/incident_draft.dart";
import "package:the_eye_mobile/incidents/incident_submission_result.dart";
import "package:the_eye_mobile/incidents/incident_submission_service.dart";
import "package:the_eye_mobile/incidents/pending_submission_store.dart";
import "package:the_eye_mobile/contracts/the_eye_enums.dart";

IncidentDraft connectivityDraft({String id = "draft-connectivity-1"}) {
  return IncidentDraft(
    clientSubmissionId: id,
    type: IncidentType.crime,
    description: "Witnessed suspicious activity near the junction.",
    latitude: 6.6018,
    longitude: 3.3515,
    locationAccuracyMeters: 12,
    capturedAt: DateTime.utc(2026, 7, 10, 1, 30),
    anonymous: true,
  );
}

TheEyeApiClient apiClientWithHealth(
    {required bool reachable, bool reportReachable = true}) {
  return TheEyeApiClient(
    baseUrl: "http://localhost:4000/v1",
    httpClient: MockClient((request) async {
      if (request.url.path.endsWith(TheEyeApiPaths.health)) {
        return reachable
            ? http.Response(jsonEncode({"status": "ok"}), 200)
            : http.Response("Service unavailable", 503);
      }
      if (request.url.path.endsWith(TheEyeApiPaths.incidentsReport)) {
        if (!reportReachable) {
          return http.Response("Service unavailable", 503);
        }
        return http.Response(
          jsonEncode({
            "id": "incident-${request.headers["x-client-submission-id"]}",
            "status": "Submitted",
            "submittedAt": "2026-07-10T01:31:00.000Z",
          }),
          200,
        );
      }
      return http.Response("Not found", 404);
    }),
  );
}

void main() {
  group("ConnectivityService", () {
    late FakeNetworkInterfaceReader network;
    late TheEyeApiClient apiClient;

    setUp(() {
      network = FakeNetworkInterfaceReader(initial: [ConnectivityResult.none]);
      apiClient = apiClientWithHealth(reachable: false);
    });

    tearDown(() {
      network.dispose();
    });

    test("startup offline reports offline before any API probe", () async {
      final service = ConnectivityService(
        apiClient: apiClient,
        networkReader: network,
        debounceDelay: Duration.zero,
      );

      await service.initialize();

      expect(service.state, ConnectivityState.offline);
      expect(service.canSubmitToApi, isFalse);
    });

    test("reconnection probes API and becomes online when reachable", () async {
      apiClient = apiClientWithHealth(reachable: true);
      network = FakeNetworkInterfaceReader(initial: [ConnectivityResult.none]);
      final service = ConnectivityService(
        apiClient: apiClient,
        networkReader: network,
        debounceDelay: Duration.zero,
      );
      await service.initialize();
      expect(service.state, ConnectivityState.offline);

      network.setConnectivity([ConnectivityResult.wifi]);
      await Future<void>.delayed(Duration.zero);
      await service.refresh();

      expect(service.state, ConnectivityState.online);
      expect(service.canSubmitToApi, isTrue);
    });

    test("API unreachable despite active network reports limited connectivity",
        () async {
      network =
          FakeNetworkInterfaceReader(initial: [ConnectivityResult.mobile]);
      apiClient = apiClientWithHealth(reachable: false);
      final service = ConnectivityService(
        apiClient: apiClient,
        networkReader: network,
        debounceDelay: Duration.zero,
      );

      await service.initialize();

      expect(service.state, ConnectivityState.limited);
      expect(service.showConnectivityBanner, isTrue);
      expect(service.canSubmitToApi, isFalse);
    });
  });

  group("PendingRetryCoordinator", () {
    test("reconnection automatically retries queued drafts", () async {
      final store = InMemoryPendingSubmissionStore();
      await store.savePending([connectivityDraft(id: "draft-reconnect")]);
      final network =
          FakeNetworkInterfaceReader(initial: [ConnectivityResult.none]);
      final apiClient = apiClientWithHealth(reachable: true);
      final connectivity = ConnectivityService(
        apiClient: apiClient,
        networkReader: network,
        debounceDelay: Duration.zero,
      );
      final submissionService =
          IncidentSubmissionService(apiClient: apiClient, pendingStore: store);
      final synced = <IncidentSubmissionResult>[];

      await connectivity.initialize();
      final coordinator = PendingRetryCoordinator(
        connectivity: connectivity,
        submissionService: submissionService,
        accessTokenProvider: () => null,
        initialDelay: const Duration(milliseconds: 20),
        maxDelay: const Duration(milliseconds: 80),
      );
      coordinator.onSyncComplete = (results) async {
        synced.addAll(results);
      };
      coordinator.start();

      network.setConnectivity([ConnectivityResult.wifi]);
      await connectivity.refresh();
      await Future<void>.delayed(const Duration(milliseconds: 50));

      expect(synced, isNotEmpty);
      expect(synced.single.isSuccess, isTrue);
      expect(await store.loadPending(), isEmpty);
      coordinator.dispose();
      network.dispose();
    });

    test("queued draft recovery after restart syncs persisted drafts",
        () async {
      final store = InMemoryPendingSubmissionStore();
      await store.savePending([connectivityDraft(id: "draft-restart")]);

      final network =
          FakeNetworkInterfaceReader(initial: [ConnectivityResult.wifi]);
      final apiClient = apiClientWithHealth(reachable: true);
      final submissionService =
          IncidentSubmissionService(apiClient: apiClient, pendingStore: store);

      final restartedService =
          IncidentSubmissionService(apiClient: apiClient, pendingStore: store);
      expect((await restartedService.pendingDrafts()).single.clientSubmissionId,
          "draft-restart");

      final connectivity = ConnectivityService(
        apiClient: apiClient,
        networkReader: network,
        debounceDelay: Duration.zero,
      );
      await connectivity.initialize();

      final results = await restartedService.syncPending();
      expect(results.single.isSuccess, isTrue);
      expect(await store.loadPending(), isEmpty);
      network.dispose();
    });

    test("network loss during submission queues draft for retry", () async {
      final store = InMemoryPendingSubmissionStore();
      final network =
          FakeNetworkInterfaceReader(initial: [ConnectivityResult.wifi]);
      final healthClient = apiClientWithHealth(reachable: true);
      final connectivity = ConnectivityService(
        apiClient: healthClient,
        networkReader: network,
        debounceDelay: Duration.zero,
      );
      await connectivity.initialize();
      expect(connectivity.isOnline, isTrue);

      final failingClient = TheEyeApiClient(
        baseUrl: "http://localhost:4000/v1",
        httpClient: MockClient(
            (_) async => throw const SocketException("Network unreachable")),
      );
      final submissionService = IncidentSubmissionService(
          apiClient: failingClient, pendingStore: store);
      final result = await submissionService.submit(
        connectivityDraft(id: "draft-loss"),
        forceOfflineQueue: !connectivity.canSubmitToApi,
      );

      expect(result.status, IncidentSubmissionStatus.networkError);
      expect(
          (await store.loadPending()).single.clientSubmissionId, "draft-loss");

      network.setConnectivity([ConnectivityResult.none]);
      await connectivity.refresh();
      expect(connectivity.state, ConnectivityState.offline);
      network.dispose();
    });

    test("retry logging omits sensitive incident details", () {
      final logs = <String>[];
      logRetryResult(
        clientSubmissionId: "draft-safe-log",
        result: const IncidentSubmissionResult(
          status: IncidentSubmissionStatus.success,
          incidentId: "incident-safe",
          userMessage: "Sensitive witness statement should not appear",
        ),
        sink: logs.add,
      );

      expect(logs.single, contains("submissionId=draft-safe-log"));
      expect(logs.single, contains("outcome=success"));
      expect(logs.single, isNot(contains("witness")));
      expect(logs.single, isNot(contains("Sensitive")));
    });
  });
}
