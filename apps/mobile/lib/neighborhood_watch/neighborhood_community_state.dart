import "neighborhood_watch_service.dart";

enum NeighborhoodCommunityState {
  ambient,
  notJoined,
  member,
}

class NeighborhoodWatchContextPresentation {
  const NeighborhoodWatchContextPresentation._({
    required this.state,
    required this.stateLabel,
    required this.areaTitle,
    required this.areaSubtitle,
    required this.canJoin,
    required this.joinPending,
    required this.membershipRestricted,
  });

  final NeighborhoodCommunityState state;
  final String stateLabel;
  final String areaTitle;
  final String areaSubtitle;
  final bool canJoin;
  final bool joinPending;
  final bool membershipRestricted;

  bool get isAmbient => state == NeighborhoodCommunityState.ambient;
  bool get isMember => state == NeighborhoodCommunityState.member;

  factory NeighborhoodWatchContextPresentation.from(
    NwContextResponse context, {
    bool isStale = false,
  }) {
    if (context.isDynamicPublicArea) {
      return NeighborhoodWatchContextPresentation._(
        state: NeighborhoodCommunityState.ambient,
        stateLabel: "Ambient area",
        areaTitle: context.dynamicArea?.areaLabel ?? "Current area",
        areaSubtitle: "Local public safety area",
        canJoin: false,
        joinPending: false,
        membershipRestricted: false,
      );
    }

    final community = context.publicCommunity;
    final membershipStatus = community?.membershipStatus?.trim();
    final normalized = membershipStatus?.toLowerCase() ?? "";
    final isMember = normalized == "approved";
    final isPending = normalized == "pending";
    final isRestricted = normalized == "suspended" || normalized == "banned";

    return NeighborhoodWatchContextPresentation._(
      state: isMember
          ? NeighborhoodCommunityState.member
          : NeighborhoodCommunityState.notJoined,
      stateLabel: isMember
          ? "Member"
          : isPending
              ? "Request pending"
              : "Not joined",
      areaTitle: community?.name ?? "Current community",
      areaSubtitle: community?.areaLabel ?? "",
      canJoin: !isStale && !isMember && !isPending && !isRestricted,
      joinPending: isPending,
      membershipRestricted: isRestricted,
    );
  }
}
