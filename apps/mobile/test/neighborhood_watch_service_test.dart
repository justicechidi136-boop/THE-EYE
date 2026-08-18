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
        expect(request.url.path,
            endsWith(TheEyeApiPaths.neighborhoodWatchCommunities));
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

  test("createCommunityRequest posts jurisdiction request", () async {
    final apiClient = TheEyeApiClient(
      baseUrl: "https://api.test/v1",
      httpClient: MockClient((request) async {
        expect(request.method, "POST");
        expect(request.url.path,
            endsWith(TheEyeApiPaths.neighborhoodWatchCommunityRequests));
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        expect(body["name"], "Trans-Amadi Residents");
        expect(body["country"], "Nigeria");
        expect(body["state"], "Rivers");
        expect(body["lga"], "Port Harcourt");
        expect(body["visibility"], "Private");
        expect(body.containsKey("ward"), isFalse);
        return http.Response(
          jsonEncode({
            "data": {
              "id": "req1",
              "name": "Trans-Amadi Residents",
              "country": "Nigeria",
              "state": "Rivers",
              "lga": "Port Harcourt",
              "visibility": "Private",
              "status": "Pending",
              "createdAt": "2026-08-18T10:00:00.000Z",
            },
          }),
          201,
          headers: {"content-type": "application/json"},
        );
      }),
    );
    final service = NeighborhoodWatchService(apiClient: apiClient);
    final request = await service.createCommunityRequest(
      accessToken: "token",
      name: "Trans-Amadi Residents",
      country: "Nigeria",
      state: "Rivers",
      lga: "Port Harcourt",
      ward: "",
      visibility: "Private",
    );
    expect(request.id, "req1");
    expect(request.status, "Pending");
    expect(request.visibility, "Private");
  });

  test("listCommunityRequests parses requester history", () async {
    final apiClient = TheEyeApiClient(
      baseUrl: "https://api.test/v1",
      httpClient: MockClient((request) async {
        expect(request.method, "GET");
        expect(request.url.path,
            endsWith(TheEyeApiPaths.neighborhoodWatchCommunityRequests));
        return http.Response(
          jsonEncode({
            "data": [
              {
                "id": "req1",
                "name": "Estate Watch",
                "country": "Nigeria",
                "status": "Pending",
              },
            ],
          }),
          200,
          headers: {"content-type": "application/json"},
        );
      }),
    );
    final service = NeighborhoodWatchService(apiClient: apiClient);
    final requests = await service.listCommunityRequests(accessToken: "token");
    expect(requests, hasLength(1));
    expect(requests.first.name, "Estate Watch");
    expect(requests.first.status, "Pending");
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
    final stats =
        await service.getStatistics(accessToken: "token", communityId: "c1");
    expect(stats.memberCount, 10);
    expect(stats.commentCount, 6);
  });

  test("resolveContext parses confirmed location context", () async {
    final apiClient = TheEyeApiClient(
      baseUrl: "https://api.test/v1",
      httpClient: MockClient((request) async {
        expect(request.url.path,
            endsWith(TheEyeApiPaths.neighborhoodWatchContext));
        expect(request.url.queryParameters["lat"], "6.45");
        expect(request.url.queryParameters["lng"], "3.39");
        expect(request.url.queryParameters["accuracy"], "20.0");
        return http.Response(
          jsonEncode({
            "locationStatus": "CONFIRMED",
            "publicCommunity": {
              "id": "c1",
              "name": "Trans-Amadi",
              "visibility": "Public",
              "country": "NG",
              "state": "Rivers",
              "lga": "Port Harcourt",
              "label": "Public Safety Community",
            },
            "presence": {
              "mode": "LOCATION_PARTICIPANT",
              "communityId": "c1",
              "capturedAt": "2026-08-12T01:00:00.000Z",
              "expiresAt": "2026-08-12T01:30:00.000Z",
              "accuracyM": 20,
              "switchRecommended": true,
              "switchMessage": "You're now in Trans-Amadi.",
            },
            "homeCommunity": null,
            "privateCommunitiesNearby": [
              {
                "id": "p1",
                "name": "Private Estate",
                "approximateDistanceMeters": 400,
                "membershipStatus": null,
                "accessHint": "Membership required.",
              },
            ],
            "permissions": {
              "canViewPublicFeed": true,
              "canPost": true,
              "canComment": true,
              "canViewPrivateFeed": false,
              "canModerate": false,
              "canManagePatrol": false,
            },
            "safetySummary": {
              "activeAlerts": 2,
              "recentVerifiedIncidents": 1,
              "roadHazards": 0,
              "publicBroadcasts": 0,
              "communityWarnings": 3,
            },
          }),
          200,
          headers: {"content-type": "application/json"},
        );
      }),
    );
    final service = NeighborhoodWatchService(apiClient: apiClient);
    final context = await service.resolveContext(
      accessToken: "token",
      lat: 6.45,
      lng: 3.39,
      accuracy: 20,
      capturedAt: DateTime.parse("2026-08-12T01:00:00.000Z"),
    );
    expect(context.locationStatus, NwLocationStatus.confirmed);
    expect(context.publicCommunity?.name, "Trans-Amadi");
    expect(context.presence?.switchMessage, "You're now in Trans-Amadi.");
    expect(context.safetySummary.activeAlerts, 2);
    expect(context.privateCommunitiesNearby, hasLength(1));
    expect(context.permissions.canPost, isTrue);
  });

  test("resolveContext parses LOCATION_REQUIRED", () async {
    final apiClient = TheEyeApiClient(
      baseUrl: "https://api.test/v1",
      httpClient: MockClient((request) async {
        return http.Response(
          jsonEncode({
            "locationStatus": "LOCATION_REQUIRED",
            "publicCommunity": null,
            "presence": null,
            "permissions": {
              "canViewPublicFeed": false,
              "canPost": false,
              "canComment": false,
              "canViewPrivateFeed": false,
              "canModerate": false,
              "canManagePatrol": false,
            },
            "safetySummary": {
              "activeAlerts": 0,
              "recentVerifiedIncidents": 0,
              "roadHazards": 0,
              "publicBroadcasts": 0,
              "communityWarnings": 0,
            },
            "privateCommunitiesNearby": [],
          }),
          200,
          headers: {"content-type": "application/json"},
        );
      }),
    );
    final service = NeighborhoodWatchService(apiClient: apiClient);
    final context =
        await service.resolveContext(accessToken: "token");
    expect(context.locationStatus, NwLocationStatus.locationRequired);
    expect(context.publicCommunity, isNull);
  });

  test("setHomeCommunity patches home community id", () async {
    final apiClient = TheEyeApiClient(
      baseUrl: "https://api.test/v1",
      httpClient: MockClient((request) async {
        expect(request.method, "PATCH");
        expect(request.url.path,
            endsWith(TheEyeApiPaths.neighborhoodWatchHomeCommunity));
        return http.Response(jsonEncode({"data": {"homeCommunityId": "c1"}}),
            200);
      }),
    );
    final service = NeighborhoodWatchService(apiClient: apiClient);
    await service.setHomeCommunity(accessToken: "token", communityId: "c1");
  });

  test("listPatrols parses member participation and safe summary", () async {
    final apiClient = TheEyeApiClient(
      baseUrl: "https://api.test/v1",
      httpClient: MockClient((request) async {
        expect(request.url.path,
            endsWith(TheEyeApiPaths.neighborhoodWatchCommunityPatrols("c1")));
        return http.Response(
          jsonEncode({
            "data": [
              {
                "id": "patrol-1",
                "communityId": "c1",
                "title": "Evening walk",
                "status": "Scheduled",
                "startsAt": "2026-08-20T18:00:00.000Z",
                "endsAt": "2026-08-20T20:00:00.000Z",
                "routeDescription": "General community patrol route",
                "participantCount": 2,
                "isParticipant": true,
                "canJoin": true,
              },
            ],
          }),
          200,
          headers: {"content-type": "application/json"},
        );
      }),
    );
    final patrol = (await NeighborhoodWatchService(apiClient: apiClient)
            .listPatrols(accessToken: "token", communityId: "c1"))
        .single;
    expect(patrol.status, "Scheduled");
    expect(patrol.participantCount, 2);
    expect(patrol.isParticipant, isTrue);
    expect(patrol.canJoin, isTrue);
  });

  test("uses configured API client instead of compile-time localhost default",
      () async {
    const stagingBase = "https://staging-api.theeye.com.ng/v1";
    final apiClient = TheEyeApiClient(
      baseUrl: stagingBase,
      httpClient: MockClient((request) async {
        expect(request.url.toString(), startsWith(stagingBase));
        return http.Response(jsonEncode({"data": []}), 200);
      }),
    );
    final service = NeighborhoodWatchService(apiClient: apiClient);
    await service.listCommunities(accessToken: "token");
  });

  test("communityFeed parses media and attached location fields", () async {
    final apiClient = TheEyeApiClient(
      baseUrl: "https://api.test/v1",
      httpClient: MockClient((request) async {
        expect(request.url.path, contains("/feed"));
        return http.Response(
          jsonEncode({
            "data": [
              {
                "id": "post-1",
                "title": "Security Tip: Lock estate gate",
                "body": "Lock the estate gate after 10 PM.",
                "type": "SafetyTip",
                "verificationStatus": "PendingVerification",
                "confidenceScore": 18,
                "commentCount": 3,
                "latitude": 4.8156,
                "longitude": 7.0498,
                "hasApproximateLocation": true,
                "media": [
                  {
                    "id": "media-1",
                    "mediaType": "Image",
                    "bucket": "the-eye",
                    "objectKey": "evidence/community-a/photo-1.jpg",
                    "contentType": "image/jpeg",
                    "fileHash": "hash-1",
                    "signedGetUrl": "https://storage.test/photo-1.jpg",
                  }
                ],
              }
            ],
            "nextCursor": null,
          }),
          200,
          headers: {"content-type": "application/json"},
        );
      }),
    );
    final service = NeighborhoodWatchService(apiClient: apiClient);
    final page = await service.communityFeed(
      accessToken: "token",
      communityId: "community-a",
    );
    expect(page.items, hasLength(1));
    expect(page.items.first.media, hasLength(1));
    expect(page.items.first.media.first.signedGetUrl,
        "https://storage.test/photo-1.jpg");
    expect(page.items.first.displayLocation, "4.8156, 7.0498");
  });
}
