import "community_post_detail_screen.dart";

/// Precedence for Neighborhood Watch post detail routing:
/// 1. Typed [CommunityPostDetailRouteArgs] when supplied (in-app navigation)
/// 2. Path postId from `/neighborhood-watch/post/:id`
/// 3. selectedCommunity id only as a soft fallback for communityId
/// 4. Empty communityId is allowed — detail must fetch the post authoritatively
CommunityPostDetailRouteArgs resolveCommunityPostRouteArgs({
  required String pathPostId,
  Object? settingsArguments,
  String? selectedCommunityId,
  String? currentUserId,
}) {
  final passed = settingsArguments is CommunityPostDetailRouteArgs
      ? settingsArguments
      : null;
  final postId =
      (passed?.postId.isNotEmpty == true) ? passed!.postId : pathPostId;
  final postTitle = (passed?.postTitle.isNotEmpty == true)
      ? passed!.postTitle
      : "Community post";
  final communityId = (passed?.communityId.isNotEmpty == true)
      ? passed!.communityId
      : (selectedCommunityId ?? "");
  return CommunityPostDetailRouteArgs(
    postId: postId,
    postTitle: postTitle,
    communityId: communityId,
    currentUserId: passed?.currentUserId ?? currentUserId,
  );
}
