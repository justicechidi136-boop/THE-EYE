import "neighborhood_watch_service.dart";

enum CommunityJoinAction {
  join,
  request,
  pending,
  member,
  declined,
  suspended,
}

String communityLocationLabel(CommunitySummary community) {
  final parts = [
    community.lga,
    community.state,
    community.country,
  ]
      .whereType<String>()
      .map((part) => part.trim())
      .where((part) => part.isNotEmpty)
      .toList();
  return parts.isEmpty ? "Location not listed" : parts.join(", ");
}

String communitySafetyStateLabel(CommunitySummary community) {
  final alerts = community.activeAlertsCount;
  if (alerts > 0) return "$alerts active safety alert${alerts == 1 ? "" : "s"}";
  return "Registered Community";
}

CommunityJoinAction communityJoinAction(CommunitySummary community) {
  return switch (community.membershipStatus) {
    "Approved" => CommunityJoinAction.member,
    "Pending" => CommunityJoinAction.pending,
    "Rejected" => CommunityJoinAction.declined,
    "Suspended" || "Banned" => CommunityJoinAction.suspended,
    _ => community.visibility == "Private"
        ? CommunityJoinAction.request
        : CommunityJoinAction.join,
  };
}

String communityJoinButtonLabel(CommunitySummary community) {
  return switch (communityJoinAction(community)) {
    CommunityJoinAction.join => "Join Community",
    CommunityJoinAction.request => "Request to Join",
    CommunityJoinAction.pending => "Request Pending",
    CommunityJoinAction.member => "Member",
    CommunityJoinAction.declined => "Request Declined",
    CommunityJoinAction.suspended => "Suspended",
  };
}

bool communityJoinActionEnabled(CommunitySummary community) {
  return switch (communityJoinAction(community)) {
    CommunityJoinAction.join || CommunityJoinAction.request => true,
    _ => false,
  };
}

bool communityMatchesCurrentArea(
  CommunitySummary community,
  CommunitySummary? currentArea,
) {
  if (currentArea == null || currentArea.id.isEmpty) return true;
  if (isDynamicAreaCommunityId(community.id)) return false;

  final currentLga = _normalized(currentArea.lga);
  final communityLga = _normalized(community.lga);
  if (currentLga.isNotEmpty && communityLga.isNotEmpty) {
    return currentLga == communityLga;
  }

  final currentState = _normalized(currentArea.state);
  final communityState = _normalized(community.state);
  if (currentState.isNotEmpty && communityState.isNotEmpty) {
    return currentState == communityState;
  }

  final currentCountry = _normalized(currentArea.country);
  final communityCountry = _normalized(community.country);
  if (currentCountry.isNotEmpty && communityCountry.isNotEmpty) {
    return currentCountry == communityCountry;
  }

  return true;
}

List<CommunitySummary> discoverableCommunitiesForArea({
  required Iterable<CommunitySummary> communities,
  required CommunitySummary? currentArea,
  String search = "",
}) {
  final query = search.trim().toLowerCase();
  return communities.where((community) {
    if (community.isMember || community.isPending) return false;
    if (!communityMatchesCurrentArea(community, currentArea)) return false;
    if (query.isEmpty) return true;
    return community.name.toLowerCase().contains(query) ||
        communityLocationLabel(community).toLowerCase().contains(query);
  }).toList(growable: false);
}

String _normalized(String? value) => (value ?? "").trim().toLowerCase();
