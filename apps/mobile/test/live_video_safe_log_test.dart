import "package:flutter/foundation.dart";
import "package:flutter_test/flutter_test.dart";

import "package:the_eye_mobile/live_video/live_video_join_flow.dart";
import "package:the_eye_mobile/live_video/live_video_safe_log.dart";

void main() {
  test("diagnostic credential metadata does not trip unsafe log guard", () {
    expect(
      () => logLiveVideoDiagnostic(
        checkpoint: LiveVideoJoinCheckpoint.sessionParsed,
        urlHost: "staging-livekit.theeye.com.ng",
        tokenLength: "635",
        tokenFingerprint: "0a1b2c3d",
      ),
      returnsNormally,
    );
  });

  test("unsafe log guard rejects raw bearer values", () {
    expect(
      () => logLiveVideoEvent(
        "live_video checkpoint=bad bearer eyJhbGciOiJIUzI1NiJ9.payload.sig",
      ),
      throwsA(isA<FlutterError>()),
    );
  });
}
