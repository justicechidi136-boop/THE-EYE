import "neighborhood_watch_service.dart";

/// Production gate for public user-initiated conversations (Start Conversation).
///
/// Mapped public communities: approved members OR confirmed `/context` with
/// `permissions.canPost` for the same community id.
/// Dynamic Public Area: confirmed dynamic context + matching synthetic id + canPost.
/// Private communities remain membership-gated.
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
  if (isDynamicAreaCommunityId(community.id)) {
    return nwContextCanPost && nwContextCommunityId == community.id;
  }
  if (community.isMember) return true;
  return nwContextCanPost && nwContextCommunityId == community.id;
}
