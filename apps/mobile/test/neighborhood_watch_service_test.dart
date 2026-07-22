import "dart:convert";

import "package:flutter_test/flutter_test.dart";
import "package:http/http.dart" as http;
import "package:http/testing.dart";
import "package:the_eye_mobile/contracts/the_eye_api_client.dart";
import "package:the_eye_mobile/contracts/the_eye_api_paths.dart";
import "package:the_eye_mobile/neighborhood_watch/neighborhood_watch_service.dart";

void main() {
  test("listCommunities parses paginated summaries", () async {
    final apiClient = TheEyeApiClient(
      baseUrl: "https://api.test/v1",
      httpClient: MockClient((request) async {
        expect(request.url.path, endsWith(TheEyeApiPaths.neighborhoodWatchCommunities));
        return http.Response(
          jsonEncode({
            "data": [
              {
                "id": "c1",
                "name": "Estate A",
                "visibility": "Public",
                "memberCount": 3,
                "activeAlertsCount": 1,
                "membershipStatus": "Approved",
              },
            ],
            "nextCursor": null,
          }),
          200,
          headers: {"content-type": "application/json"},
        );
      }),
    );
    final service = NeighborhoodWatchService(apiClient: apiClient);
    final page = await service.listCommunities(accessToken: "token");
    expect(page.items, hasLength(1));
    expect(page.items.first.name, "Estate A");
    expect(page.items.first.isMember, isTrue);
  });

  test("listMembers parses badges and pagination cursor", () async {
    final apiClient = TheEyeApiClient(
      baseUrl: "https://api.test/v1",
      httpClient: MockClient((request) async {
        expect(request.url.path, contains("/members"));
        return http.Response(
          jsonEncode({
            "data": [
              {
                "id": "m1",
                "userId": "u1",
                "displayName": "Ada Lovelace",
                "role": "SecurityCoordinator",
                "badges": ["SecurityCoordinator", "Moderator", "PatrolLead"],
                "isVolunteer": true,
              },
            ],
            "nextCursor": "cursor-2",
          }),
          200,
          headers: {"content-type": "application/json"},
        );
      }),
    );
    final service = NeighborhoodWatchService(apiClient: apiClient);
    final page = await service.listMembers(
      accessToken: "token",
      communityId: "c1",
      search: "Ada",
    );
    expect(page.items.first.displayName, "Ada Lovelace");
    expect(page.items.first.badges, contains("Moderator"));
    expect(page.nextCursor, "cursor-2");
  });

  test("getStatistics parses community counters", () async {
    final apiClient = TheEyeApiClient(
      baseUrl: "https://api.test/v1",
      httpClient: MockClient((request) async {
        expect(request.url.path, contains("/statistics"));
        return http.Response(
          jsonEncode({
            "data": {
              "memberCount": 10,
              "activeVolunteers": 2,
              "patrolCount": 1,
              "activeAlerts": 3,
              "incidentCount": 4,
              "postCount": 5,
              "commentCount": 6,
              "memberGrowth30Days": 7,
            },
          }),
          200,
          headers: {"content-type": "application/json"},
        );
      }),
    );
    final service = NeighborhoodWatchService(apiClient: apiClient);
    final stats = await service.getStatistics(accessToken: "token", communityId: "c1");
    expect(stats.memberCount, 10);
    expect(stats.commentCount, 6);
  });
}
