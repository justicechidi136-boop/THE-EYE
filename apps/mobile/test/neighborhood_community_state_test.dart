import "dart:io";

import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/neighborhood_watch/neighborhood_community_state.dart";
import "package:the_eye_mobile/neighborhood_watch/neighborhood_watch_service.dart";

void main() {
  NwContextResponse context({
    String contextType = "MAPPED_PUBLIC_COMMUNITY",
    String? membershipStatus,
    bool canPost = true,
    String? homeCommunityId,
    bool includePrivateNearby = false,
  }) {
    return NwContextResponse.fromJson({
      "locationStatus": "CONFIRMED",
      "contextType": contextType,
      "publicCommunity": contextType == "MAPPED_PUBLIC_COMMUNITY"
          ? {
              "id": "current-community",
              "name": "Rumuola Community Watch",
              "visibility": "Public",
              "country": "Nigeria",
              "state": "Rivers",
              "lga": "Obio-Akpor",
              "membershipStatus": membershipStatus,
            }
          : null,
      "dynamicArea": contextType == "DYNAMIC_PUBLIC_AREA"
          ? {
              "areaKey": "da:NIGERIA:RIVERS:OBIO_AKPOR",
              "areaLabel": "Rumuola, Rivers, Nigeria",
              "countryCode": "NIGERIA",
            }
          : null,
      "homeCommunity": homeCommunityId == null
          ? null
          : {
              "id": homeCommunityId,
              "name": "Saved Home Community",
              "visibility": "Public",
              "country": "Nigeria",
            },
      "privateCommunitiesNearby": includePrivateNearby
          ? [
              {
                "id": "private-nearby",
                "name": "Private Estate",
                "approximateDistanceMeters": 200,
                "membershipStatus": "Approved",
              }
            ]
          : const [],
      "permissions": {
        "canViewPublicFeed": true,
        "canPost": canPost,
        "canComment": canPost,
      },
    });
  }

  group("NeighborhoodWatchContextPresentation", () {
    test("dynamic public area resolves automatically to Ambient", () {
      final presentation = NeighborhoodWatchContextPresentation.from(
        context(contextType: "DYNAMIC_PUBLIC_AREA"),
      );

      expect(presentation.state, NeighborhoodCommunityState.ambient);
      expect(presentation.stateLabel, "Ambient area");
      expect(presentation.canJoin, isFalse);
    });

    test("mapped community without membership resolves to Not Joined", () {
      final presentation = NeighborhoodWatchContextPresentation.from(
        context(canPost: true),
      );

      expect(presentation.state, NeighborhoodCommunityState.notJoined);
      expect(presentation.stateLabel, "Not joined");
      expect(presentation.canJoin, isTrue);
    });

    test("approved membership resolves to Member without using canPost", () {
      final presentation = NeighborhoodWatchContextPresentation.from(
        context(membershipStatus: "Approved", canPost: false),
      );

      expect(presentation.state, NeighborhoodCommunityState.member);
      expect(presentation.isMember, isTrue);
      expect(presentation.canJoin, isFalse);
    });

    test("pending membership remains Not Joined and prevents duplicate join",
        () {
      final presentation = NeighborhoodWatchContextPresentation.from(
        context(membershipStatus: "Pending"),
      );

      expect(presentation.state, NeighborhoodCommunityState.notJoined);
      expect(presentation.stateLabel, "Request pending");
      expect(presentation.joinPending, isTrue);
      expect(presentation.canJoin, isFalse);
    });

    test("home and private memberships do not alter current public state", () {
      final presentation = NeighborhoodWatchContextPresentation.from(
        context(
          homeCommunityId: "another-community",
          includePrivateNearby: true,
        ),
      );

      expect(presentation.state, NeighborhoodCommunityState.notJoined);
    });

    test("stale context retains state but cannot offer a fresh join action",
        () {
      final presentation = NeighborhoodWatchContextPresentation.from(
        context(),
        isStale: true,
      );

      expect(presentation.state, NeighborhoodCommunityState.notJoined);
      expect(presentation.canJoin, isFalse);
    });

    test("suspended membership does not resolve to Member or allow joining",
        () {
      final presentation = NeighborhoodWatchContextPresentation.from(
        context(membershipStatus: "Suspended"),
      );

      expect(presentation.state, NeighborhoodCommunityState.notJoined);
      expect(presentation.membershipRestricted, isTrue);
      expect(presentation.canJoin, isFalse);
    });
  });

  test("state selector is absent while real navigation tabs remain", () {
    final source =
        File("lib/neighborhood_watch/nw_home_screen.dart").readAsStringSync();

    expect(
      source.contains('labels: const ["Ambient", "Not joined", "Member"]'),
      isFalse,
    );
    expect(source.contains("modeIndex"), isFalse);
    expect(
      source.contains(
        'labels: const ["Home", "Feed", "Broadcasts", "Community"]',
      ),
      isTrue,
    );
  });
}
