import "package:connectivity_plus/connectivity_plus.dart";
import "package:flutter_test/flutter_test.dart";
import "package:livekit_client/livekit_client.dart";

import "package:the_eye_mobile/live_video/live_video_connect_diagnostics.dart";

void main() {
  test("formatLiveVideoConnectivity joins result names", () {
    expect(
      formatLiveVideoConnectivity(const [
        ConnectivityResult.wifi,
        ConnectivityResult.mobile,
      ]),
      "wifi|mobile",
    );
  });

  test("formatLiveKitConnectException preserves connect reason", () {
    final formatted = formatLiveKitConnectException(
      ConnectException(
        "no internet connection",
        reason: ConnectionErrorReason.InternalError,
        statusCode: 503,
      ),
    );
    expect(formatted, contains("ConnectException"));
    expect(formatted, contains("InternalError"));
    expect(formatted, contains("503"));
    expect(formatted, contains("no internet connection"));
  });
}
