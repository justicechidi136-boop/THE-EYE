import "package:flutter_test/flutter_test.dart";

import "package:shared_preferences/shared_preferences.dart";

import "package:the_eye_mobile/neighborhood_watch/neighborhood_watch_destinations.dart";

import "package:the_eye_mobile/neighborhood_watch/neighborhood_watch_service.dart";

import "package:the_eye_mobile/neighborhood_watch/nw_context_cache.dart";

void main() {
  group("NeighborhoodWatchDestinations", () {
    test("builds post, patrol, private, and membership routes", () {
      expect(
        NeighborhoodWatchDestinations.post("abc"),
        "/neighborhood-watch/post/abc",
      );

      expect(
        NeighborhoodWatchDestinations.patrol("sched-1"),
        "/neighborhood-watch/patrol/sched-1",
      );

      expect(
        NeighborhoodWatchDestinations.privateCommunity("priv-1"),
        "/neighborhood-watch/private/priv-1",
      );

      expect(
        NeighborhoodWatchDestinations.privateCommunityMembership("priv-1"),
        "/neighborhood-watch/private/priv-1/membership",
      );

      expect(
        NeighborhoodWatchDestinations.requestCommunity,
        "/neighborhood-watch/request-community",
      );
    });

    test("detects dynamic route prefixes", () {
      expect(
        NeighborhoodWatchDestinations.isPostRoute(
          "/neighborhood-watch/post/post-1",
        ),
        isTrue,
      );

      expect(
        NeighborhoodWatchDestinations.isPatrolRoute(
          "/neighborhood-watch/patrol/patrol-1",
        ),
        isTrue,
      );

      expect(
        NeighborhoodWatchDestinations.isPrivateCommunityRoute(
          "/neighborhood-watch/private/community-1",
        ),
        isTrue,
      );

      expect(
        NeighborhoodWatchDestinations.isPrivateMembershipRoute(
          "/neighborhood-watch/private/community-1/membership",
        ),
        isTrue,
      );

      expect(NeighborhoodWatchDestinations.isPostRoute("/neighborhood-watch"),
          isFalse);
    });

    test("extracts ids from dynamic routes", () {
      expect(
        NeighborhoodWatchDestinations.postIdFromRoute(
          "/neighborhood-watch/post/post-99",
        ),
        "post-99",
      );

      expect(
        NeighborhoodWatchDestinations.patrolIdFromRoute(
          "/neighborhood-watch/patrol/patrol-99",
        ),
        "patrol-99",
      );

      expect(
        NeighborhoodWatchDestinations.privateCommunityIdFromRoute(
          "/neighborhood-watch/private/community-99",
        ),
        "community-99",
      );

      expect(
        NeighborhoodWatchDestinations.privateCommunityIdFromRoute(
          "/neighborhood-watch/private/community-99/membership",
        ),
        "community-99",
      );
    });
  });

  group("NwContextResponse parsing", () {
    test("maps location status labels and retry hints", () {
      expect(
        nwLocationStatusLabel(NwLocationStatus.locationStale),
        "Location is stale",
      );

      expect(
        nwLocationStatusRetryHint(NwLocationStatus.locationLowAccuracy),
        contains("GPS"),
      );
    });

    test("builds community summary from public card", () {
      final card = NwPublicCommunityCard.fromJson({
        "id": "c1",
        "name": "Zone A",
        "visibility": "Public",
        "country": "NG",
        "state": "Lagos",
        "lga": "Ikeja",
      });

      final summary = card.toCommunitySummary(activeAlertsCount: 4);

      expect(summary.id, "c1");

      expect(summary.activeAlertsCount, 4);

      expect(card.areaLabel, contains("Ikeja"));
    });
  });

  group("NwContextCache", () {
    test("strips live presence for stale display", () {
      final context = NwContextResponse.fromJson({
        "locationStatus": "CONFIRMED",
        "publicCommunity": {
          "id": "c1",
          "name": "Zone A",
          "visibility": "Public",
          "country": "NG",
        },
        "presence": {
          "mode": "LOCATION_PARTICIPANT",
          "communityId": "c1",
          "accuracyM": 18,
          "capturedAt": "2026-08-12T01:00:00.000Z",
        },
        "permissions": {"canViewPublicFeed": true},
        "safetySummary": {"activeAlerts": 1},
      });

      final stale = stripLivePresence(context);

      expect(stale.presence, isNull);

      expect(stale.publicCommunity?.name, "Zone A");
    });

    test("labels cached context as STALE", () {
      final cachedAt = DateTime.parse("2026-08-12T01:00:00.000Z");

      final message = nwContextStaleBannerMessage(cachedAt);

      expect(message, startsWith("STALE"));

      expect(message, contains("GPS"));
    });

    test("roundtrips context through SharedPreferences", () async {
      SharedPreferences.setMockInitialValues({});

      final cache = NwContextCache();

      final context = NwContextResponse.fromJson({
        "locationStatus": "CONFIRMED",
        "publicCommunity": {
          "id": "c1",
          "name": "Zone A",
          "visibility": "Public",
          "country": "NG",
        },
        "permissions": {"canViewPublicFeed": true},
        "safetySummary": {"activeAlerts": 2},
      });

      await cache.save("user-1", context);

      final loaded = await cache.load("user-1");

      expect(loaded, isNotNull);

      expect(loaded!.context.publicCommunity?.id, "c1");

      expect(loaded.context.safetySummary.activeAlerts, 2);
    });
  });
}
