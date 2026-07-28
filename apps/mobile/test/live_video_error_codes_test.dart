import "package:flutter_test/flutter_test.dart";

import "package:the_eye_mobile/live_video/live_video_error_codes.dart";

void main() {
  group("live video error taxonomy", () {
    test("maps nginx 502 to LIVE-VIDEO-009 gateway code", () {
      final message = mapLiveVideoApiError(502, "bad gateway");
      expect(message, contains("LIVE-VIDEO-009"));
      expect(message, contains("emergency may still have been submitted"));
    });

    test("maps API 500 without code to LIVE-VIDEO-011", () {
      final message = mapLiveVideoApiError(500, "internal error");
      expect(message, contains("LIVE-VIDEO-011"));
    });

    test("maps API client URL invalid code", () {
      final message = mapLiveVideoApiError(
        500,
        "invalid url",
        apiCode: "LIVE-VIDEO-010",
      );
      expect(message, contains("LIVE-VIDEO-010"));
    });

    test("retry message preserves active emergency", () {
      expect(
        liveVideoRetryUserMessage(incidentActive: true),
        "Your emergency is active. Retry secure live video.",
      );
    });
  });
}
