import "dart:async";
import "dart:convert";
import "dart:io";

import "package:flutter_test/flutter_test.dart";
import "package:http/http.dart" as http;
import "package:http/testing.dart";

import "package:the_eye_mobile/contracts/the_eye_api_paths.dart";
import "package:the_eye_mobile/incidents/incident_draft.dart";
import "package:the_eye_mobile/incidents/incident_draft_factory.dart";
import "package:the_eye_mobile/incidents/incident_submission_result.dart";
import "package:the_eye_mobile/incidents/incident_submission_service.dart";
import "package:the_eye_mobile/incidents/pending_submission_store.dart";
import "package:the_eye_mobile/contracts/the_eye_api_client.dart";
import "package:the_eye_mobile/contracts/the_eye_enums.dart";

IncidentDraft sampleDraft({String? clientSubmissionId}) {
  return IncidentDraft(
    clientSubmissionId: clientSubmissionId ?? "draft-test-1",
    type: IncidentType.crime,
    description: "Witnessed suspicious activity near the junction.",
    latitude: 6.6018,
    longitude: 3.3515,
    locationAccuracyMeters: 12,
    capturedAt: DateTime.utc(2026, 7, 10, 1, 30),
    anonymous: true,
  );
}

void main() {
  group("IncidentSubmissionService", () {
    test("valid submission returns success with incident id", () async {
      final store = InMemoryPendingSubmissionStore();
      final client = TheEyeApiClient(
        baseUrl: "http://localhost:4000/v1",
        httpClient: MockClient((request) async {
          expect(request.url.path, endsWith(TheEyeApiPaths.incidentsReport));
          expect(request.headers["x-client-submission-id"], "draft-test-1");
          return http.Response(
            jsonEncode({
              "id": "incident-123",
              "status": "Submitted",
              "priority": "P3SuspiciousActivity",
              "submittedAt": "2026-07-10T01:31:00.000Z",
              "fastPath": false,
            }),
            200,
            headers: {"content-type": "application/json"},
          );
        }),
      );

      final service =
          IncidentSubmissionService(apiClient: client, pendingStore: store);
      final result = await service.submit(sampleDraft());

      expect(result.status, IncidentSubmissionStatus.success);
      expect(result.incidentId, "incident-123");
      expect(result.serverStatus, "Submitted");
      expect(await store.loadPending(), isEmpty);
    });

    test("missing required fields returns validation error", () async {
      final service = IncidentSubmissionService(
        apiClient: TheEyeApiClient(
            httpClient: MockClient((_) async => http.Response("{}", 500))),
        pendingStore: InMemoryPendingSubmissionStore(),
      );

      final result = await service.submit(
        IncidentDraft(
          clientSubmissionId: "draft-short",
          type: IncidentType.crime,
          description: "bad",
          latitude: 6.6,
          longitude: 3.3,
          capturedAt: DateTime.now().toUtc(),
        ),
      );

      expect(result.status, IncidentSubmissionStatus.validationError);
      expect(result.fieldErrors["description"], isNotNull);
    });

    test("identified report without token is unauthorized at validation",
        () async {
      final service = IncidentSubmissionService(
        apiClient: TheEyeApiClient(
            httpClient: MockClient((_) async => http.Response("{}", 500))),
        pendingStore: InMemoryPendingSubmissionStore(),
      );

      final result = await service.submit(
        sampleDraft().copyWith(anonymous: false),
      );

      expect(result.status, IncidentSubmissionStatus.validationError);
      expect(result.fieldErrors["anonymous"], isNotNull);
    });

    test("server validation error surfaces user-facing message", () async {
      final client = TheEyeApiClient(
        httpClient: MockClient((_) async => http.Response(
            jsonEncode({"message": "Description is required"}), 400)),
      );
      final service = IncidentSubmissionService(
          apiClient: client, pendingStore: InMemoryPendingSubmissionStore());
      final result =
          await service.submit(sampleDraft(clientSubmissionId: "draft-400"));

      expect(result.status, IncidentSubmissionStatus.serverValidationError);
      expect(result.userMessage, "Description is required");
    });

    test("timeout queues draft for retry", () async {
      final store = InMemoryPendingSubmissionStore();
      final client = TheEyeApiClient(
        httpClient: MockClient((_) async {
          await Future<void>.delayed(const Duration(milliseconds: 50));
          return http.Response("{}", 200);
        }),
      );
      final service = IncidentSubmissionService(
        apiClient: client,
        pendingStore: store,
        requestTimeout: const Duration(milliseconds: 10),
      );

      final result = await service
          .submit(sampleDraft(clientSubmissionId: "draft-timeout"));

      expect(result.status, IncidentSubmissionStatus.timeout);
      expect((await store.loadPending()).length, 1);
    });

    test("network loss queues draft for retry", () async {
      final store = InMemoryPendingSubmissionStore();
      final client = TheEyeApiClient(
        httpClient: MockClient(
            (_) async => throw const SocketException("Failed host lookup")),
      );
      final service =
          IncidentSubmissionService(apiClient: client, pendingStore: store);
      final result = await service
          .submit(sampleDraft(clientSubmissionId: "draft-offline"));

      expect(result.status, IncidentSubmissionStatus.networkError);
      expect((await store.loadPending()).single.clientSubmissionId,
          "draft-offline");
    });

    test("duplicate tap prevention blocks in-flight submission", () async {
      final completer = Completer<http.Response>();
      final client = TheEyeApiClient(
        httpClient: MockClient((_) => completer.future),
      );
      final service = IncidentSubmissionService(
          apiClient: client, pendingStore: InMemoryPendingSubmissionStore());
      final draft = sampleDraft(clientSubmissionId: "draft-dupe");

      final first = service.submit(draft);
      final second = await service.submit(draft);
      completer.complete(http.Response(
          jsonEncode({
            "id": "incident-999",
            "status": "Submitted",
            "submittedAt": "2026-07-10T01:31:00.000Z"
          }),
          200));

      expect(second.status, IncidentSubmissionStatus.duplicateInFlight);
      final firstResult = await first;
      expect(firstResult.isSuccess, isTrue);
    });

    test("syncPending retries queued drafts", () async {
      final store = InMemoryPendingSubmissionStore();
      await store.savePending([sampleDraft(clientSubmissionId: "draft-retry")]);
      var calls = 0;
      final client = TheEyeApiClient(
        httpClient: MockClient((_) async {
          calls += 1;
          return http.Response(
            jsonEncode({
              "id": "incident-retry",
              "status": "Submitted",
              "submittedAt": "2026-07-10T01:31:00.000Z"
            }),
            200,
          );
        }),
      );
      final service =
          IncidentSubmissionService(apiClient: client, pendingStore: store);
      final results = await service.syncPending();

      expect(calls, 1);
      expect(results.single.isSuccess, isTrue);
      expect(await store.loadPending(), isEmpty);
    });

    test("unauthorized API response maps to sign-in message", () async {
      final client = TheEyeApiClient(
        httpClient: MockClient((_) async =>
            http.Response(jsonEncode({"message": "Unauthorized"}), 401)),
      );
      final service = IncidentSubmissionService(
          apiClient: client, pendingStore: InMemoryPendingSubmissionStore());
      final result = await service.submit(
        sampleDraft(clientSubmissionId: "draft-401"),
        accessToken: "bad-token",
      );

      expect(result.status, IncidentSubmissionStatus.unauthorized);
      expect(result.userMessage, contains("Sign in"));
    });
  });

  test("normalizeIncidentDescription pads short emergency text", () {
    final normalized = normalizeIncidentDescription("", fallback: "Emergency");
    expect(normalized.length >= TheEyeEnums.descriptionMinLength, isTrue);
  });
}

extension on IncidentDraft {
  IncidentDraft copyWith({bool? anonymous}) {
    return IncidentDraft(
      clientSubmissionId: clientSubmissionId,
      type: type,
      description: description,
      latitude: latitude,
      longitude: longitude,
      capturedAt: capturedAt,
      locationAccuracyMeters: locationAccuracyMeters,
      anonymous: anonymous ?? this.anonymous,
    );
  }
}
