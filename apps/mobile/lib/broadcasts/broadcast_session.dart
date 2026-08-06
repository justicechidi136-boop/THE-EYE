import "package:flutter/material.dart";

import "../app/app_scope.dart";
import "../app/session_accessor.dart";
import "broadcast_feed_service.dart";
import "broadcast_submission_service.dart";

/// Broadcast capabilities exposed by [AppController] without importing [main.dart].
abstract class BroadcastSession extends SessionAccessor {
  BroadcastFeedService get broadcastFeedService;
  BroadcastSubmissionService get broadcastSubmissionService;
  Future<void> markBroadcastRead(String broadcastId);
  Future<void> loadBroadcastsFromApi({bool refresh = false});

  static BroadcastSession require(BuildContext context) {
    final session = AppScope.of(context);
    assert(
      session is BroadcastSession,
      "BroadcastSession required in AppScope",
    );
    return session as BroadcastSession;
  }
}
