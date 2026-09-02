import "dart:convert";

import "package:flutter_test/flutter_test.dart";
import "package:http/http.dart" as http;
import "package:http/testing.dart";
import "package:shared_preferences/shared_preferences.dart";
import "package:the_eye_mobile/contracts/the_eye_api_client.dart";
import "package:the_eye_mobile/emergency/active_emergency_service.dart";

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test("loads every authorized active emergency across cursor pages", () async {
    SharedPreferences.setMockInitialValues({});
    final requestedCursors = <String?>[];
    final client = TheEyeApiClient(
      httpClient: MockClient((request) async {
        if (request.url.path.endsWith("/incidents")) {
          final cursor = request.url.queryParameters["cursor"];
          requestedCursors.add(cursor);
          return http.Response(
            jsonEncode({
              "data": [
                {
                  "id": cursor == null ? "incident-1" : "incident-2",
                  "status": cursor == null ? "Submitted" : "Responding",
                  "type": cursor == null ? "Emergency" : "Accident",
                  "title": cursor == null ? "First" : "Second",
                  "submittedAt": "2026-09-02T10:00:00.000Z",
                },
                if (cursor != null)
                  {
                    "id": "incident-ended",
                    "status": "Ended",
                    "type": "Emergency",
                    "title": "Ended emergency",
                  },
              ],
              "hasMore": cursor == null,
              "nextCursor": cursor == null ? "page-2" : null,
            }),
            200,
          );
        }
        return http.Response("{}", 500);
      }),
    );

    final items = await ActiveEmergencyService(apiClient: client)
        .listActiveEmergencySnapshots("token");

    expect(requestedCursors, [null, "page-2"]);
    expect(items.map((item) => item.incidentId), ["incident-1", "incident-2"]);
    expect(items.map((item) => item.status), ["Submitted", "Responding"]);
  });
}
