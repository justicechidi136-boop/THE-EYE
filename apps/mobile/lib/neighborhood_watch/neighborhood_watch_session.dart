import "neighborhood_watch_service.dart";

/// Neighborhood Watch community selection surface without importing [main.dart].
abstract class NeighborhoodWatchSession {
  CommunitySummary? get selectedCommunity;
  void selectCommunity(CommunitySummary community);

  /// Applies GPS context selection + public posting permission from `/context`.
  void applyNeighborhoodWatchContext({
    required CommunitySummary community,
    required bool canPost,
  });

  /// Clears presence-based posting authority when context has no public community.
  void clearNeighborhoodWatchParticipationContext();
}
