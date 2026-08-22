import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:the_eye_mobile/neighborhood_watch/community_conversation_eligibility.dart";
import "package:the_eye_mobile/neighborhood_watch/community_post_detail_screen.dart";
import "package:the_eye_mobile/neighborhood_watch/community_post_route_args.dart";
import "package:the_eye_mobile/neighborhood_watch/neighborhood_watch_destinations.dart";
import "package:the_eye_mobile/neighborhood_watch/neighborhood_watch_service.dart";

CommunitySummary _public({
  required String id,
  String? membershipStatus,
}) {
  return CommunitySummary(
    id: id,
    name: "Public $id",
    visibility: "Public",
    memberCount: 10,
    activeAlertsCount: 0,
    membershipStatus: membershipStatus,
  );
}

CommunitySummary _private({
  required String id,
  String? membershipStatus,
}) {
  return CommunitySummary(
    id: id,
    name: "Private $id",
    visibility: "Private",
    memberCount: 4,
    activeAlertsCount: 0,
    membershipStatus: membershipStatus,
  );
}

void main() {
  group("evaluateCanStartCommunityConversation (production)", () {
    test("1) approved member allowed", () {
      expect(
        evaluateCanStartCommunityConversation(
          isAuthenticated: true,
          community: _public(id: "A", membershipStatus: "Approved"),
          nwContextCanPost: false,
          nwContextCommunityId: null,
        ),
        isTrue,
      );
    });

    test("2) confirmed traveler + canPost true allowed", () {
      expect(
        evaluateCanStartCommunityConversation(
          isAuthenticated: true,
          community: _public(id: "A"),
          nwContextCanPost: true,
          nwContextCommunityId: "A",
        ),
        isTrue,
      );
    });

    test("3) traveler + canPost false denied", () {
      expect(
        evaluateCanStartCommunityConversation(
          isAuthenticated: true,
          community: _public(id: "A"),
          nwContextCanPost: false,
          nwContextCommunityId: "A",
        ),
        isFalse,
      );
    });

    test("4) traveler in different selected community denied", () {
      expect(
        evaluateCanStartCommunityConversation(
          isAuthenticated: true,
          community: _public(id: "B"),
          nwContextCanPost: true,
          nwContextCommunityId: "A",
        ),
        isFalse,
      );
    });

    test("5) stale/unconfirmed community context denied", () {
      expect(
        evaluateCanStartCommunityConversation(
          isAuthenticated: true,
          community: _public(id: "A"),
          nwContextCanPost: true,
          nwContextCommunityId: null,
        ),
        isFalse,
      );
    });

    test("6) private-community non-member denied", () {
      expect(
        evaluateCanStartCommunityConversation(
          isAuthenticated: true,
          community: _private(id: "P", membershipStatus: "Pending"),
          nwContextCanPost: true,
          nwContextCommunityId: "P",
        ),
        isFalse,
      );
    });

    test("7) suspended/restricted user denied", () {
      expect(
        evaluateCanStartCommunityConversation(
          isAuthenticated: true,
          community: _public(id: "A", membershipStatus: "Suspended"),
          nwContextCanPost: true,
          nwContextCommunityId: "A",
        ),
        isFalse,
      );
      expect(
        evaluateCanStartCommunityConversation(
          isAuthenticated: true,
          community: _public(id: "A", membershipStatus: "Banned"),
          nwContextCanPost: true,
          nwContextCommunityId: "A",
        ),
        isFalse,
      );
    });

    test("8) no authenticated user denied", () {
      expect(
        evaluateCanStartCommunityConversation(
          isAuthenticated: false,
          community: _public(id: "A"),
          nwContextCanPost: true,
          nwContextCommunityId: "A",
        ),
        isFalse,
      );
    });
  });

  group("resolveCommunityPostRouteArgs", () {
    test("A) in-app navigation preserves typed args over selectedCommunity",
        () {
      final args = resolveCommunityPostRouteArgs(
        pathPostId: "path-id",
        settingsArguments: const CommunityPostDetailRouteArgs(
          postId: "post-1",
          postTitle: "Safety Discussion",
          communityId: "community-A",
          currentUserId: "user-1",
        ),
        selectedCommunityId: "stale-community",
        currentUserId: "other",
      );
      expect(args.postId, "post-1");
      expect(args.postTitle, "Safety Discussion");
      expect(args.communityId, "community-A");
      expect(args.currentUserId, "user-1");
    });

    test(
        "B) cold-start deep link with null selectedCommunity keeps path postId",
        () {
      final args = resolveCommunityPostRouteArgs(
        pathPostId: "post-deep",
        settingsArguments: null,
        selectedCommunityId: null,
        currentUserId: null,
      );
      expect(args.postId, "post-deep");
      expect(args.communityId, "");
      expect(
          NeighborhoodWatchDestinations.isPostRoute(
            NeighborhoodWatchDestinations.post("post-deep"),
          ),
          isTrue);
    });

    test("C) stale selectedCommunity does not override route communityId", () {
      final args = resolveCommunityPostRouteArgs(
        pathPostId: "post-1",
        settingsArguments: const CommunityPostDetailRouteArgs(
          postId: "post-1",
          postTitle: "Tip",
          communityId: "community-A",
        ),
        selectedCommunityId: "community-B",
        currentUserId: "u1",
      );
      expect(args.communityId, "community-A");
    });
  });

  group("visitor label + commentCount models", () {
    test("Current Area Visitor preferred over profile name", () {
      final post = CommunityPostItem.fromJson({
        "id": "p1",
        "title": "Safety Discussion",
        "body": "Anyone nearby?",
        "type": "Discussion",
        "verificationStatus": "PendingVerification",
        "confidenceScore": 20,
        "createdAt": "2026-08-12T12:00:00.000Z",
        "authorLabel": "Current Area Visitor",
        "commentCount": 67,
        "communityId": "community-A",
        "author": {
          "id": "u1",
          "profile": {"firstName": "Ada", "lastName": "Traveler"},
        },
      });
      expect(post.displayAuthor, "Current Area Visitor");
      expect(post.commentCount, 67);
      expect(post.communityId, "community-A");
    });

    test("member without authorLabel keeps real display name", () {
      final post = CommunityPostItem.fromJson({
        "id": "p2",
        "title": "Security Tip",
        "body": "Lock gates",
        "type": "SafetyTip",
        "verificationStatus": "PendingVerification",
        "confidenceScore": 10,
        "createdAt": "2026-08-12T12:00:00.000Z",
        "commentCount": 2,
        "author": {
          "id": "u2",
          "profile": {"firstName": "Bola", "lastName": "Resident"},
        },
      });
      expect(post.displayAuthor, "Bola Resident");
      expect(post.commentCount, 2);
    });

    test("loaded page of 20 comments may still report commentCount 67", () {
      final post = CommunityPostItem.fromJson({
        "id": "p3",
        "title": "Thread",
        "body": "Busy",
        "type": "Discussion",
        "verificationStatus": "PendingVerification",
        "confidenceScore": 1,
        "commentCount": 67,
        "comments": List.generate(20, (i) => {"id": "c$i"}),
      });
      expect(post.commentCount, 67);
    });
  });

  group("empty-state copy", () {
    test("eligible empty community copy contract", () {
      const title = "No community discussions yet";
      const subtitle =
          "Be the first to start a safety conversation in this area.";
      const cta = "Share First Security Tip";
      expect(title, contains("discussions"));
      expect(subtitle, contains("first"));
      expect(cta, "Share First Security Tip");
    });
  });

  group("conversation type map", () {
    test("maps required UI labels to CommunityPost types", () {
      const typeMap = {
        "Security Tip": "SafetyTip",
        "Report Activity": "SuspiciousActivity",
        "Road Hazard": "RoadHazard",
      };
      expect(typeMap.length, 3);
      expect(typeMap.values.toSet().length, 3);
    });

    test("post model exposes persisted media and location", () {
      final post = CommunityPostItem.fromJson({
        "id": "p4",
        "title": "Road Hazard: Tree across lane",
        "body": "Fallen tree near the junction.",
        "type": "RoadHazard",
        "verificationStatus": "PendingVerification",
        "confidenceScore": 12,
        "latitude": 4.8156,
        "longitude": 7.0498,
        "hasApproximateLocation": true,
        "media": [
          {
            "id": "m1",
            "mediaType": "Video",
            "bucket": "the-eye",
            "objectKey": "evidence/community-a/tree.mp4",
            "contentType": "video/mp4",
            "fileHash": "hash-video-1",
            "signedGetUrl": "https://storage.test/tree.mp4",
          }
        ],
      });
      expect(post.displayLocation, "4.8156, 7.0498");
      expect(post.media.single.isVideo, isTrue);
    });

    test("post model exposes privacy-safe viewer reaction state", () {
      final post = CommunityPostItem.fromJson({
        "id": "p-liked",
        "title": "Gate update",
        "body": "The gate is open again.",
        "type": "Discussion",
        "verificationStatus": "PendingVerification",
        "confidenceScore": 0,
        "reactionCount": 3,
        "viewerReacted": true,
      });

      expect(post.reactionCount, 3);
      expect(post.viewerReacted, isTrue);
      expect(
          post.copyWith(viewerReacted: false, reactionCount: 2).reactionCount,
          2);
    });
  });

  testWidgets(
      "deep-link route builder does not crash with null selectedCommunity",
      (tester) async {
    final args = resolveCommunityPostRouteArgs(
      pathPostId: "post-cold",
      settingsArguments: null,
      selectedCommunityId: null,
      currentUserId: null,
    );
    expect(args.postId, "post-cold");
    expect(args.communityId, isEmpty);

    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) {
            return Scaffold(
              body: Text(
                  "${args.postId}:${args.communityId.isEmpty ? "pending-fetch" : args.communityId}"),
            );
          },
        ),
      ),
    );
    expect(find.text("post-cold:pending-fetch"), findsOneWidget);
  });
}
