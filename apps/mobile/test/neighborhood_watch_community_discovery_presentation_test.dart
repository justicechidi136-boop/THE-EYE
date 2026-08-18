import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/neighborhood_watch/community_discovery_presentation.dart";
import "package:the_eye_mobile/neighborhood_watch/neighborhood_watch_service.dart";

void main() {
  group("community discovery presentation", () {
    test("filters discovery by current area while hiding existing memberships",
        () {
      final currentArea = _community(
        id: "current",
        name: "Obio-Akpor Current Area",
        state: "Rivers",
        lga: "Obio-Akpor",
      );
      final items = discoverableCommunitiesForArea(
        currentArea: currentArea,
        communities: [
          _community(id: "obio", name: "Obio-Akpor Watch", lga: "Obio-Akpor"),
          _community(id: "rumuola", name: "Rumuola Watch", lga: "Rumuola"),
          _community(
            id: "member",
            name: "My Existing Watch",
            lga: "Obio-Akpor",
            membershipStatus: "Approved",
          ),
        ],
      );

      expect(items.map((item) => item.id), ["obio"]);
    });

    test("location change updates discovery but not membership list source", () {
      final rumuolaArea = _community(
        id: "current",
        name: "Rumuola Current Area",
        state: "Rivers",
        lga: "Rumuola",
      );
      final communities = [
        _community(id: "obio", name: "Obio-Akpor Watch", lga: "Obio-Akpor"),
        _community(id: "rumuola", name: "Rumuola Watch", lga: "Rumuola"),
        _community(
          id: "mine",
          name: "My Approved Community",
          lga: "Obio-Akpor",
          membershipStatus: "Approved",
        ),
      ];

      final discovery = discoverableCommunitiesForArea(
        communities: communities,
        currentArea: rumuolaArea,
      );
      final memberships = communities
          .where((community) => community.membershipStatus == "Approved")
          .toList();

      expect(discovery.map((item) => item.id), ["rumuola"]);
      expect(memberships.map((item) => item.id), ["mine"]);
    });

    test("join button reflects open and approval-required states", () {
      expect(communityJoinButtonLabel(_community(visibility: "Public")),
          "Join Community");
      expect(communityJoinButtonLabel(_community(visibility: "Private")),
          "Request to Join");
      expect(
        communityJoinButtonLabel(_community(membershipStatus: "Pending")),
        "Request Pending",
      );
      expect(
        communityJoinButtonLabel(_community(membershipStatus: "Approved")),
        "Member",
      );
      expect(
        communityJoinButtonLabel(_community(membershipStatus: "Rejected")),
        "Request Declined",
      );
      expect(
        communityJoinButtonLabel(_community(membershipStatus: "Suspended")),
        "Suspended",
      );
    });

    test("duplicate join is disabled for pending, member, and declined states",
        () {
      expect(communityJoinActionEnabled(_community(visibility: "Public")),
          isTrue);
      expect(communityJoinActionEnabled(_community(visibility: "Private")),
          isTrue);
      expect(
        communityJoinActionEnabled(_community(membershipStatus: "Pending")),
        isFalse,
      );
      expect(
        communityJoinActionEnabled(_community(membershipStatus: "Approved")),
        isFalse,
      );
      expect(
        communityJoinActionEnabled(_community(membershipStatus: "Rejected")),
        isFalse,
      );
    });

    test("preview labels avoid private member details", () {
      final community = _community(
        name: "Obio-Akpor Watch",
        state: "Rivers",
        lga: "Obio-Akpor",
        activeAlertsCount: 2,
      );

      expect(communityLocationLabel(community), "Obio-Akpor, Rivers, Nigeria");
      expect(communitySafetyStateLabel(community), "2 active safety alerts");
    });
  });
}

CommunitySummary _community({
  String id = "c1",
  String name = "Community",
  String visibility = "Public",
  String? country = "Nigeria",
  String? state = "Rivers",
  String? lga,
  String? membershipStatus,
  int activeAlertsCount = 0,
}) {
  return CommunitySummary(
    id: id,
    name: name,
    visibility: visibility,
    memberCount: 12,
    activeAlertsCount: activeAlertsCount,
    country: country,
    state: state,
    lga: lga,
    membershipStatus: membershipStatus,
  );
}
