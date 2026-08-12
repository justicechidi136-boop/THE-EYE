import "dart:convert";

import "package:flutter_test/flutter_test.dart";
import "package:http/http.dart" as http;
import "package:http/testing.dart";

import "package:the_eye_mobile/broadcasts/broadcast_submission_service.dart";
import "package:the_eye_mobile/contracts/the_eye_api_client.dart";
import "package:the_eye_mobile/contracts/the_eye_api_paths.dart";
import "package:the_eye_mobile/incidents/incident_submission_service.dart";

void main() {
  test("submitSighting posts only to sightings endpoint on success", () async {
    final requests = <Uri>[];
    final client = TheEyeApiClient(
      baseUrl: "http://localhost:4000/v1",
      httpClient: MockClient((request) async {
        requests.add(request.url);
        expect(request.url.path, endsWith("/broadcasts/b1/sightings"));
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        expect(body["clientSightingId"], "action-1");
        expect(body["description"], "Seen near the market.");
        return http.Response(
          jsonEncode({
            "data": {"id": "sighting-1"}
          }),
          201,
          headers: {"content-type": "application/json"},
        );
      }),
    );
    final service = BroadcastSubmissionService(apiClient: client);

    final result = await service.submitSighting(
      accessToken: "token",
      broadcastId: "b1",
      clientActionId: "action-1",
      description: "Seen near the market.",
      locationMode: "NOT_PROVIDED",
    );

    expect(result.id, "sighting-1");
    expect(requests, hasLength(1));
    expect(
      requests.single.path.endsWith("/comments"),
      isFalse,
    );
  });

  test("submitSighting forwards location mode and attachments", () async {
    Map<String, dynamic>? requestBody;
    final client = TheEyeApiClient(
      baseUrl: "http://localhost:4000/v1",
      httpClient: MockClient((request) async {
        requestBody = jsonDecode(request.body) as Map<String, dynamic>;
        return http.Response(
          jsonEncode({
            "data": {"id": "sighting-2"}
          }),
          201,
          headers: {"content-type": "application/json"},
        );
      }),
    );
    final service = BroadcastSubmissionService(apiClient: client);

    await service.submitSighting(
      accessToken: "token",
      broadcastId: "b2",
      clientActionId: "action-9",
      description: "Observed near expressway",
      locationMode: "CURRENT_GPS",
      latitude: 6.5,
      longitude: 3.4,
      attachments: const [
        {
          "mediaType": "image",
          "bucket": "the-eye",
          "objectKey": "evidence/broadcast-user-1/photo.jpg",
          "contentType": "image/jpeg",
          "fileName": "photo.jpg",
        },
      ],
    );

    expect(requestBody?["locationMode"], "CURRENT_GPS");
    expect(requestBody?["attachments"], isA<List<dynamic>>());
    expect((requestBody?["attachments"] as List).length, 1);
  });

  test(
      "503 sighting failure throws temporary unavailable and never posts comment",
      () async {
    final requests = <Uri>[];
    final client = TheEyeApiClient(
      baseUrl: "http://localhost:4000/v1",
      httpClient: MockClient((request) async {
        requests.add(request.url);
        if (request.url.path.endsWith("/sightings")) {
          return http.Response(
            jsonEncode({"message": "Service unavailable"}),
            503,
            headers: {"content-type": "application/json"},
          );
        }
        fail("Unexpected request to ${request.url.path}");
      }),
    );
    final service = BroadcastSubmissionService(apiClient: client);

    await expectLater(
      service.submitSighting(
        accessToken: "token",
        broadcastId: "b1",
        clientActionId: "action-2",
        description: "Blue shirt heading north.",
        locationMode: "NOT_PROVIDED",
      ),
      throwsA(isA<BroadcastSightingUnavailableException>()),
    );
    expect(requests, hasLength(1));
    expect(requests.single.path, contains("/sightings"));
  });

  test("404 sighting failure is treated as temporary unavailable", () async {
    final client = TheEyeApiClient(
      baseUrl: "http://localhost:4000/v1",
      httpClient: MockClient((request) async {
        return http.Response(jsonEncode({"message": "Not found"}), 404);
      }),
    );
    final service = BroadcastSubmissionService(apiClient: client);

    await expectLater(
      service.submitSighting(
        accessToken: "token",
        broadcastId: "b1",
        clientActionId: "action-3",
        description: "Possible match.",
        locationMode: "NOT_PROVIDED",
      ),
      throwsA(
        predicate((Object error) =>
            error is BroadcastSightingUnavailableException &&
            error.statusCode == 404),
      ),
    );
  });

  test("createStolenVehicle forwards source vehicle snapshot metadata", () async {
    Map<String, dynamic>? requestBody;
    final client = TheEyeApiClient(
      baseUrl: "http://localhost:4000/v1",
      httpClient: MockClient((request) async {
        requestBody = jsonDecode(request.body) as Map<String, dynamic>;
        expect(request.url.path, endsWith("/broadcasts/stolen-vehicle"));
        return http.Response(
          jsonEncode({
            "data": {"id": "vehicle-1", "status": "Active"}
          }),
          201,
          headers: {"content-type": "application/json"},
        );
      }),
    );
    final service = BroadcastSubmissionService(apiClient: client);

    final result = await service.createStolenVehicle(
      accessToken: "token",
      payload: {
        "clientBroadcastId": "broadcast-123",
        "vehicleType": "Car",
        "make": "Toyota",
        "model": "Corolla",
        "year": 2021,
        "registrationNumber": "ABC-123",
        "colour": "Red",
        "metadata": {
          "sourceVehicleId": "vehicle-2",
          "make": "Toyota",
          "model": "Corolla",
          "year": 2021,
          "colour": "Red",
          "registrationNumber": "ABC-123",
          "vinLastFour": "1A2B",
        },
      },
    );

    expect(result.id, "vehicle-1");
    expect(requestBody?["year"], 2021);
    expect(requestBody?["metadata"]?["sourceVehicleId"], "vehicle-2");
    expect(requestBody?["metadata"]?["year"], 2021);
    expect(requestBody?["metadata"]?["vinLastFour"], "1A2B");
  });

  test("addComment rejects duplicate submission within five seconds", () async {
    var postCount = 0;
    final client = TheEyeApiClient(
      baseUrl: "http://localhost:4000/v1",
      httpClient: MockClient((request) async {
        postCount += 1;
        return http.Response(
          jsonEncode({
            "data": {"id": "c-$postCount", "body": "Hello"}
          }),
          201,
        );
      }),
    );
    final service = BroadcastSubmissionService(apiClient: client);

    await service.addComment(
      accessToken: "token",
      broadcastId: "b1",
      body: "Hello",
    );
    expect(
      () => service.addComment(
        accessToken: "token",
        broadcastId: "b1",
        body: "Hello",
      ),
      throwsA(isA<IncidentApiException>()),
    );
    expect(postCount, 1);
  });
}
