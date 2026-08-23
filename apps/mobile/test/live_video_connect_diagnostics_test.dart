import "package:connectivity_plus/connectivity_plus.dart";
import "package:flutter_test/flutter_test.dart";
import "package:livekit_client/livekit_client.dart";

import "package:the_eye_mobile/live_video/live_video_connect_diagnostics.dart";

class _FakeStatsReport {
  _FakeStatsReport(this.type, this.values);

  final String type;
  final Map<String, Object?> values;
}

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

  test("normalizes safe ICE candidates and selected pair metadata", () {
    final result = normalizeLiveKitIceStats([
      _FakeStatsReport("remote-candidate", {
        "candidateType": "host",
        "protocol": "udp",
        "address": "134.209.190.77",
        "port": 7882,
        "priority": 2130706431,
      }),
      _FakeStatsReport("candidate-pair", {
        "state": "succeeded",
        "nominated": true,
      }),
    ]);

    expect(result, hasLength(2));
    expect(result.first["direction"], "remote");
    expect(result.first["candidateType"], "host");
    expect(result.first["protocol"], "udp");
    expect(result.first["address"], "134.209.190.77");
    expect(result.first["port"], "7882");
    expect(result.last["state"], "succeeded");
    expect(result.last["selected"], "true");
  });

  test("drops unsafe or unsupported ICE candidate values", () {
    final result = normalizeLiveKitIceStats([
      _FakeStatsReport("remote-candidate", {
        "candidateType": "secret-type",
        "protocol": "file",
        "address": "unsafe address bearer token",
        "port": 70000,
        "priority": -1,
      }),
    ]);

    expect(result, [
      {"kind": "candidate", "direction": "remote"},
    ]);
  });

  test("extracts candidate fields from SDP without ICE credentials", () {
    const sdp = """
v=0
a=ice-ufrag:must-not-be-logged
a=ice-pwd:must-not-be-logged
a=candidate:serverudp 1 udp 2130706431 134.209.190.77 7882 typ host
a=candidate:servertcp 1 tcp 1671430143 134.209.190.77 7881 typ host tcptype passive
""";

    final result = normalizeLiveKitIceSdp(sdp, direction: "remote");

    expect(result, hasLength(2));
    expect(result.first["address"], "134.209.190.77");
    expect(result.first["port"], "7882");
    expect(result.first["protocol"], "udp");
    expect(result.last["port"], "7881");
    expect(result.last["protocol"], "tcp");
    expect(result.toString(), isNot(contains("must-not-be-logged")));
  });
}
