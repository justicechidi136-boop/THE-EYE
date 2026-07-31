import "package:flutter_test/flutter_test.dart";

import "package:the_eye_mobile/live_video/live_video_join_flow.dart";

void main() {
  test("join flow tracker records connect begin state", () {
    final tracker = LiveVideoJoinFlowTracker();
    expect(tracker.roomConnectBeginLogged, isFalse);
    tracker.mark(LiveVideoJoinCheckpoint.roomConnectBegin);
    expect(tracker.roomConnectBeginLogged, isTrue);
    expect(tracker.roomConnectSuccessLogged, isFalse);
  });

  test("join flow tracker records interrupt metadata", () {
    final tracker = LiveVideoJoinFlowTracker();
    tracker.recordInterrupt(
      reason: "widget_unmounted",
      location: "_startStream:after_preview",
    );
    expect(
      tracker.checkpoints,
      contains(LiveVideoJoinCheckpoint.joinFlowInterrupted),
    );
    expect(tracker.interruptReason, "widget_unmounted");
    expect(tracker.interruptLocation, "_startStream:after_preview");
  });
}
