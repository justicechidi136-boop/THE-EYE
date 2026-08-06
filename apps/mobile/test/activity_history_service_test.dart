import "dart:convert";

import "package:flutter_test/flutter_test.dart";
import "package:http/http.dart" as http;
import "package:the_eye_mobile/activity/activity_history_service.dart";
import "package:the_eye_mobile/contracts/the_eye_api_client.dart";

class _FakeApiClient extends TheEyeApiClient {
  _FakeApiClient(this.responses);

  final Map<String, http.Response> responses;

  @override
  Future<http.Response> getJson(
    String path, {
    String? accessToken,
    Map<String, String>? query,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final key = query == null || query.isEmpty ? path : "$path?${Uri(queryParameters: query).query}";
    return responses[key] ?? responses[path] ?? http.Response('{"data":[]}', 404);
  }
}

void main() {
  test("activity history service maps unified feed items", () async {
    final service = ActivityHistoryService(
      apiClient: _FakeApiClient({
        "/users/me/activity-history?section=All&limit=25": http.Response(
          jsonEncode({
            "data": [
              {
                "sourceType": "incident",
                "kind": "EmergencyReport",
                "id": "inc-1",
                "category": "Emergency",
                "status": "Responding",
                "lifecycle": "active",
                "statusBadge": "Responding",
                "occurredAt": "2026-08-01T09:00:00.000Z",
                "dateLabel": "2026-08-01",
                "timeLabel": "09:00",
                "verificationStatus": "Verified",
                "unreadUpdatesCount": 2,
                "timelinePreview": [
                  {"label": "Submitted", "at": "2026-08-01T09:00:00.000Z", "type": "report.submitted"},
                ],
                "navigation": {"destination": "active-emergency", "incidentId": "inc-1"},
                "isActive": true,
                "isTerminal": false,
                "title": "Emergency",
              },
              {
                "sourceType": "broadcast",
                "kind": "MissingPersonBroadcast",
                "id": "bc-1",
                "category": "MissingPerson",
                "status": "Active",
                "lifecycle": "active",
                "statusBadge": "Active",
                "occurredAt": "2026-08-01T08:00:00.000Z",
                "dateLabel": "2026-08-01",
                "timeLabel": "08:00",
                "verificationStatus": "Pending",
                "broadcastReach": 120,
                "unreadUpdatesCount": 0,
                "timelinePreview": [
                  {"label": "Broadcast created", "at": "2026-08-01T08:00:00.000Z", "type": "broadcast.created"},
                ],
                "navigation": {"destination": "broadcast-archive", "broadcastId": "bc-1"},
                "isActive": true,
                "isTerminal": false,
                "title": "Missing person",
              },
            ],
            "hasMore": false,
            "nextCursor": null,
          }),
          200,
        ),
      }),
    );

    final page = await service.listActivityHistory(accessToken: "token", section: "All");
    expect(page.items, hasLength(2));
    expect(page.items.first.navigation.destination, "active-emergency");
    expect(page.items.last.kind, "MissingPersonBroadcast");
  });

  test("activity history service loads incident archive payload", () async {
    final service = ActivityHistoryService(
      apiClient: _FakeApiClient({
        "/incidents/inc-1/archive": http.Response(
          jsonEncode({
            "data": {
              "archive": true,
              "readOnly": true,
              "incidentId": "inc-1",
              "timeline": [{"label": "Submitted", "at": "2026-08-01T09:00:00.000Z"}],
            },
          }),
          200,
        ),
      }),
    );

    final archive = await service.getIncidentArchive(accessToken: "token", incidentId: "inc-1");
    expect(archive["readOnly"], isTrue);
    expect(archive["incidentId"], "inc-1");
  });
}
