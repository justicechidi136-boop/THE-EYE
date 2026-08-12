import "package:flutter_test/flutter_test.dart";

import "package:the_eye_mobile/neighborhood_watch/neighborhood_watch_destinations.dart";
import "package:the_eye_mobile/neighborhood_watch/neighborhood_watch_service.dart";

void main() {
  group("Public community conversations", () {
    test("2) Start Conversation eligibility for public non-member", () {
      const travelerCommunity = CommunitySummary(
        id: "lagos-1",
        name: "Lagos Public",
        visibility: "Public",
        memberCount: 12,
        activeAlertsCount: 0,
        membershipStatus: null,
      );
      const privateLocked = CommunitySummary(
        id: "estate-1",
        name: "Private Estate",
        visibility: "Private",
        memberCount: 4,
        activeAlertsCount: 0,
        membershipStatus: "Pending",
      );
      const privateMember = CommunitySummary(
        id: "estate-1",
        name: "Private Estate",
        visibility: "Private",
        memberCount: 4,
        activeAlertsCount: 0,
        membershipStatus: "Approved",
      );

      bool canStart({
        required bool authenticated,
        required CommunitySummary? community,
      }) {
        if (!authenticated) return false;
        if (community == null || community.id.isEmpty) return false;
        if (community.visibility == "Private") return community.isMember;
        if (community.membershipStatus == "Suspended" ||
            community.membershipStatus == "Banned") {
          return false;
        }
        return true;
      }

      expect(
        canStart(authenticated: true, community: travelerCommunity),
        isTrue,
      );
      expect(canStart(authenticated: true, community: privateLocked), isFalse);
      expect(canStart(authenticated: true, community: privateMember), isTrue);
      expect(
        canStart(authenticated: false, community: travelerCommunity),
        isFalse,
      );
    });

    test("empty-state copy contract for discussions", () {
      const title = "No community discussions yet";
      const subtitle =
          "Be the first to start a safety conversation in this area.";
      const cta = "Start Conversation";
      expect(title.contains("discussions"), isTrue);
      expect(subtitle.contains("first"), isTrue);
      expect(cta, "Start Conversation");
    });

    test("conversation type labels map to CommunityPost types", () {
      const typeMap = {
        "Safety Discussion": "Discussion",
        "Security Tip": "SafetyTip",
        "Community Question": "CommunityQuestion",
        "Local Warning": "LocalWarning",
        "Road / Environmental Hazard": "RoadHazard",
        "Suspicious Activity": "SuspiciousActivity",
      };
      expect(typeMap.length, 6);
      expect(typeMap.values.toSet().length, 6);
    });

    test("14) discussion deep link parses post id", () {
      const route = "/neighborhood-watch/post/post-abc";
      expect(NeighborhoodWatchDestinations.isPostRoute(route), isTrue);
      expect(NeighborhoodWatchDestinations.postIdFromRoute(route), "post-abc");
      expect(
        NeighborhoodWatchDestinations.post("post-abc"),
        "/neighborhood-watch/post/post-abc",
      );
    });

    test("17) Report Emergency uses canonical route", () {
      expect("/report/emergency", "/report/emergency");
    });

    test("Current Area Visitor author label parses from feed JSON", () {
      final post = CommunityPostItem.fromJson({
        "id": "p1",
        "title": "Safety Discussion",
        "body": "Anyone nearby?",
        "type": "Discussion",
        "verificationStatus": "PendingVerification",
        "confidenceScore": 20,
        "createdAt": "2026-08-12T12:00:00.000Z",
        "authorLabel": "Current Area Visitor",
        "commentCount": 12,
        "author": {
          "id": "u1",
          "displayName": "Hidden Name",
        },
      });
      expect(post.displayAuthor, "Current Area Visitor");
      expect(post.commentCount, 12);
    });

    test("voice comment authorLabel prefers visitor label", () {
      final comment = CommunityCommentItem.fromJson({
        "id": "c1",
        "body": "",
        "hasVoice": true,
        "durationSeconds": 8,
        "mediaType": "Audio",
        "authorLabel": "Current Area Visitor",
        "author": {"id": "u2", "displayName": "Someone"},
        "createdAt": "2026-08-12T12:01:00.000Z",
      });
      expect(comment.authorName, "Current Area Visitor");
      expect(comment.isVoiceComment, isTrue);
    });
  });
}
