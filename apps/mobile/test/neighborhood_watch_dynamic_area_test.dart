import "package:flutter_test/flutter_test.dart";

import "package:the_eye_mobile/neighborhood_watch/community_conversation_eligibility.dart";
import "package:the_eye_mobile/neighborhood_watch/neighborhood_watch_service.dart";

void main() {
  group("Dynamic Public Area context parsing", () {
    test("parses DYNAMIC_PUBLIC_AREA with canPost", () {
      final ctx = NwContextResponse.fromJson({
        "locationStatus": "CONFIRMED",
        "contextType": "DYNAMIC_PUBLIC_AREA",
        "publicCommunity": null,
        "dynamicArea": {
          "countryCode": "NIGERIA",
          "stateCode": "RIVERS",
          "lgaCode": "OBIO_AKPOR",
          "city": "Port Harcourt",
          "areaLabel": "Obio-Akpor, Rivers, Nigeria",
          "areaKey": "da:NIGERIA:RIVERS:OBIO_AKPOR",
        },
        "permissions": {
          "canViewPublicFeed": true,
          "canPost": true,
          "canComment": true,
          "canReportActivity": true,
          "canShareSecurityTip": true,
          "canVerify": true,
          "canViewPrivateFeed": false,
          "canModerate": false,
          "canManagePatrol": false,
        },
        "privateCommunitiesNearby": [
          {
            "id": "priv-1",
            "name": "Green Valley Estate",
            "approximateDistanceMeters": 180,
          }
        ],
      });

      expect(ctx.isDynamicPublicArea, isTrue);
      expect(ctx.isUsablePublicContext, isTrue);
      expect(ctx.permissions.canPost, isTrue);
      expect(ctx.dynamicArea?.areaKey, "da:NIGERIA:RIVERS:OBIO_AKPOR");
      expect(ctx.privateCommunitiesNearby, hasLength(1));
    });

    test("location failures are not treated as usable Dynamic Area", () {
      for (final status in [
        "LOCATION_REQUIRED",
        "LOCATION_STALE",
        "LOCATION_LOW_ACCURACY",
      ]) {
        final ctx = NwContextResponse.fromJson({
          "locationStatus": status,
          "contextType": status,
          "permissions": {"canPost": false},
        });
        expect(ctx.isUsablePublicContext, isFalse, reason: status);
        expect(ctx.permissions.canPost, isFalse, reason: status);
      }
    });

    test("legacy NO_PUBLIC_COMMUNITY does not unlock posting", () {
      final ctx = NwContextResponse.fromJson({
        "locationStatus": "NO_PUBLIC_COMMUNITY",
        "permissions": {"canPost": false},
      });
      expect(ctx.isUsablePublicContext, isFalse);
    });
  });

  group("Dynamic Area Start Conversation eligibility", () {
    test("confirmed dynamic area with matching synthetic id can start", () {
      final community = const NwDynamicArea(
        areaKey: "da:NIGERIA:ENUGU:ENUGU_NORTH",
        areaLabel: "Enugu North, Enugu, Nigeria",
        countryCode: "NIGERIA",
        stateCode: "ENUGU",
        lgaCode: "ENUGU_NORTH",
      ).toCommunitySummary();

      expect(isDynamicAreaCommunityId(community.id), isTrue);
      expect(
        evaluateCanStartCommunityConversation(
          isAuthenticated: true,
          community: community,
          nwContextCanPost: true,
          nwContextCommunityId: community.id,
        ),
        isTrue,
      );
    });

    test("forged or mismatched dynamic area id cannot start", () {
      final community = const NwDynamicArea(
        areaKey: "da:NIGERIA:ENUGU:ENUGU_NORTH",
        areaLabel: "Enugu",
        countryCode: "NIGERIA",
      ).toCommunitySummary();

      expect(
        evaluateCanStartCommunityConversation(
          isAuthenticated: true,
          community: community,
          nwContextCanPost: true,
          nwContextCommunityId: dynamicAreaCommunityId("da:FORGED"),
        ),
        isFalse,
      );
    });
  });
}
