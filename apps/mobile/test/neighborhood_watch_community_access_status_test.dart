import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/neighborhood_watch/community_access_status.dart";
import "package:the_eye_mobile/neighborhood_watch/neighborhood_watch_service.dart";

void main() {
  group("communityAccessStatus", () {
    test("does not mark selected community outside when it is current area", () {
      final community = _community("c1", "Obio-Akpor Watch");

      final status = communityAccessStatus(
        selectedCommunity: community,
        currentAreaCommunityId: "c1",
      );

      expect(status.isOutsideCurrentArea, isFalse);
    });

    test("marks saved membership outside when GPS current area differs", () {
      final community = _community("obio", "Obio-Akpor Watch");

      final status = communityAccessStatus(
        selectedCommunity: community,
        currentAreaCommunityId: "rumuola",
      );

      expect(status.isOutsideCurrentArea, isTrue);
      expect(status.title, "Viewing Obio-Akpor Watch");
      expect(status.message, "You are currently outside this community.");
    });

    test("keeps dynamic current-area selections local to GPS context", () {
      final dynamic = const NwDynamicArea(
        areaKey: "da:NIGERIA:RIVERS:OBIO_AKPOR",
        areaLabel: "Obio-Akpor, Rivers",
        countryCode: "Nigeria",
      ).toCommunitySummary();

      final status = communityAccessStatus(
        selectedCommunity: dynamic,
        currentAreaCommunityId: "c1",
      );

      expect(status.isOutsideCurrentArea, isFalse);
    });

    test("does not claim outside status until current area is known", () {
      final community = _community("obio", "Obio-Akpor Watch");

      final status = communityAccessStatus(
        selectedCommunity: community,
        currentAreaCommunityId: null,
      );

      expect(status.isOutsideCurrentArea, isFalse);
    });
  });
}

CommunitySummary _community(String id, String name) {
  return CommunitySummary(
    id: id,
    name: name,
    visibility: "Public",
    memberCount: 12,
    activeAlertsCount: 0,
    membershipStatus: "Approved",
  );
}
