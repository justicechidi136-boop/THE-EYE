import "neighborhood_watch_service.dart";

class CommunityAccessStatus {
  const CommunityAccessStatus({
    required this.isOutsideCurrentArea,
    required this.title,
    required this.message,
  });

  final bool isOutsideCurrentArea;
  final String title;
  final String message;
}

CommunityAccessStatus communityAccessStatus({
  required CommunitySummary? selectedCommunity,
  required String? currentAreaCommunityId,
}) {
  if (selectedCommunity == null || selectedCommunity.id.isEmpty) {
    return const CommunityAccessStatus(
      isOutsideCurrentArea: false,
      title: "",
      message: "",
    );
  }
  if (isDynamicAreaCommunityId(selectedCommunity.id)) {
    return const CommunityAccessStatus(
      isOutsideCurrentArea: false,
      title: "",
      message: "",
    );
  }
  if (currentAreaCommunityId == null || currentAreaCommunityId.isEmpty) {
    return const CommunityAccessStatus(
      isOutsideCurrentArea: false,
      title: "",
      message: "",
    );
  }
  if (selectedCommunity.id == currentAreaCommunityId) {
    return const CommunityAccessStatus(
      isOutsideCurrentArea: false,
      title: "",
      message: "",
    );
  }
  return CommunityAccessStatus(
    isOutsideCurrentArea: true,
    title: "Viewing ${selectedCommunity.name}",
    message: "You are currently outside this community.",
  );
}
