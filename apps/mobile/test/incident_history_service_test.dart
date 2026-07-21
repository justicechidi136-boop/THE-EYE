import "dart:convert";

import "package:flutter_test/flutter_test.dart";
import "package:http/http.dart" as http;
import "package:http/testing.dart";

import "package:the_eye_mobile/contracts/the_eye_api_client.dart";
import "package:the_eye_mobile/incidents/incident_history_service.dart";

void main() {
  test("incident history service maps list and detail responses", () async {
    final client = TheEyeApiClient(
      baseUrl: "https://example.test/v1",
      httpClient: MockClient((request) async {
        if (request.url.path.endsWith("/incidents")) {
          return http.Response(
            jsonEncode({
              "data": [
                {
                  "id": "inc-1",
                  "type": "Crime",
                  "status": "Submitted",
                  "description": "Test incident",
                  "submittedAt": "2026-07-22T00:00:00.000Z",
                },
              ],
              "hasMore": false,
              "nextCursor": null,
            }),
            200,
          );
        }
        return http.Response(
          jsonEncode({
            "id": "inc-1",
            "type": "Crime",
            "status": "Submitted",
            "description": "Test incident",
            "timeline": [
              {"createdAt": "2026-07-22T00:00:00.000Z", "message": "Submitted", "actorType": "user"},
            ],
            "statusHistory": [
              {"fromStatus": null, "toStatus": "Submitted", "note": "Created", "createdAt": "2026-07-22T00:00:00.000Z"},
            ],
            "media": [{"id": "media-1"}],
          }),
          200,
        );
      }),
    );

    final service = IncidentHistoryService(apiClient: client);
    final rows = await service.listIncidents(accessToken: "token");
    expect(rows, hasLength(1));
    expect(rows.first.id, "inc-1");

    final detail = await service.getIncident(accessToken: "token", incidentId: "inc-1");
    expect(detail.evidenceCount, 1);
    expect(detail.timeline, isNotEmpty);
    expect(detail.statusHistory, isNotEmpty);
  });
}
