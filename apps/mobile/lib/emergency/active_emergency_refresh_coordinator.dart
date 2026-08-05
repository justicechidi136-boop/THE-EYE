import "active_emergency_contract.dart";

class ActiveEmergencyRefreshCoordinator {
  int _generation = 0;

  int beginRefresh() => ++_generation;

  bool isCurrent(int generation) => generation == _generation;

  bool shouldAccept({
    required int generation,
    required int incomingStatusVersion,
    required DateTime incomingUpdatedAt,
    int? currentStatusVersion,
    DateTime? currentUpdatedAt,
  }) {
    if (!isCurrent(generation)) return false;
    if (currentStatusVersion == null || currentUpdatedAt == null) return true;
    if (incomingStatusVersion > currentStatusVersion) return true;
    if (incomingStatusVersion < currentStatusVersion) return false;
    return !incomingUpdatedAt.isBefore(currentUpdatedAt);
  }

  DateTime? updatedAtFor(ActiveEmergencyContract contract) {
    if (contract is ActiveEmergencyActiveContract) {
      return contract.lastUpdatedAt;
    }
    return null;
  }
}
