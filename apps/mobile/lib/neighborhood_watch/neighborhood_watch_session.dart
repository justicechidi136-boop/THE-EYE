import "neighborhood_watch_service.dart";

/// Neighborhood Watch community selection surface without importing [main.dart].
abstract class NeighborhoodWatchSession {
  CommunitySummary? get selectedCommunity;
  void selectCommunity(CommunitySummary community);
}
