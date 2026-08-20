import "broadcast_feed_service.dart";

class BroadcastActionPolicy {
  const BroadcastActionPolicy._({
    required this.isOwner,
    required this.canShare,
    required this.canReportSighting,
    required this.canComment,
    required this.canReportBroadcast,
    required this.canResolve,
    required this.canWithdraw,
  });

  final bool isOwner;
  final bool canShare;
  final bool canReportSighting;
  final bool canComment;
  final bool canReportBroadcast;
  final bool canResolve;
  final bool canWithdraw;

  factory BroadcastActionPolicy.forViewer({
    required BroadcastFeedItem broadcast,
    required String? currentUserId,
  }) {
    final viewerId = currentUserId?.trim() ?? "";
    final ownerId = broadcast.creatorUserId?.trim() ?? "";
    final isOwner = viewerId.isNotEmpty && ownerId == viewerId;
    final status = _normalize(broadcast.status);
    final type = _normalize(broadcast.type);
    final isLive = !broadcast.expired &&
        const {"active", "published", "updated"}.contains(status);
    final supportsSightings =
        type == "missingperson" || type == "stolenvehicle";

    return BroadcastActionPolicy._(
      isOwner: isOwner,
      canShare: status != "suspended",
      canReportSighting: isLive && supportsSightings,
      canComment: status != "suspended",
      canReportBroadcast: isLive && !isOwner,
      canResolve: isLive && isOwner,
      canWithdraw: isLive && isOwner,
    );
  }

  static String _normalize(String value) =>
      value.trim().toLowerCase().replaceAll(RegExp(r"[^a-z0-9]"), "");
}
