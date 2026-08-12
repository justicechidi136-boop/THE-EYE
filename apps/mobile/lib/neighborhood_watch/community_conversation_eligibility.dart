import "neighborhood_watch_service.dart";

/// Production gate for public user-initiated conversations (Start Conversation).
///
/// Public travelers require confirmed NW `/context` for the selected community
/// with `permissions.canPost`. Approved members of a public community may start
/// without live presence. Private communities remain membership-gated.
bool evaluateCanStartCommunityConversation({
  required bool isAuthenticated,
  required CommunitySummary? community,
  required bool nwContextCanPost,
  required String? nwContextCommunityId,
}) {
  if (!isAuthenticated) return false;
  if (community == null || community.id.isEmpty) return false;
  if (community.visibility == "Private") return community.isMember;
  if (community.membershipStatus == "Suspended" ||
      community.membershipStatus == "Banned") {
    return false;
  }
  if (community.isMember) return true;
  return nwContextCanPost && nwContextCommunityId == community.id;
}
