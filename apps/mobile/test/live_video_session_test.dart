import "package:flutter_test/flutter_test.dart";

import "package:the_eye_mobile/live_video/live_video_api_models.dart";
import "package:the_eye_mobile/live_video/live_video_connection_state.dart";
import "package:the_eye_mobile/live_video/live_video_evidence_overlay.dart";

void main() {
  group("live video api models", () {
    test("parses livekit credentials and evidence overlay from start response",
        () {
      final result = LiveVideoStartResult.fromResponse({
        "data": {
          "id": "session-1",
          "incidentId": "incident-1",
          "roomName": "eye-incident-incident-1",
          "recordingMediaId": null,
          "evidenceOverlay": {
            "title": "THE EYE LIVE EVIDENCE",
            "incidentId": "incident-1",
            "date": "10 July 2026",
            "time": "03:36:00 WAT",
            "gps": "6.5244, 3.3792",
            "accuracy": "±12m",
            "reporter": "Anonymous-inc1",
            "sessionId": "session-1",
          },
        },
        "livekit": {
          "url": "wss://livekit.example",
          "roomName": "eye-incident-incident-1",
          "token": "signed-token",
        },
      });

      expect(result.sessionId, "session-1");
      expect(result.livekit.isValid, isTrue);
      expect(result.recordingConfigured, isFalse);
      expect(result.evidenceOverlay?["incidentId"], "incident-1");
    });

    test("maps token failure without leaking secrets", () {
      final message = mapLiveVideoApiError(
          403, "Forbidden room access for token abc-secret");
      expect(message, contains("not authorized"));
      expect(message, isNot(contains("abc-secret")));
    });

    test("maps permission denial and connection loss labels", () {
      expect(liveVideoConnectionLabel(LiveVideoConnectionState.failed),
          "Connection failed");
      expect(liveVideoConnectionLabel(LiveVideoConnectionState.reconnecting),
          "Reconnecting");
      expect(liveVideoConnectionLabel(LiveVideoConnectionState.disconnected),
          "Disconnected");
    });

    test("builds evidence overlay with connection status", () {
      final overlay = LiveVideoEvidenceOverlay.fromApi(
        const {
          "title": "THE EYE LIVE EVIDENCE",
          "incidentId": "incident-1",
          "date": "10 July 2026",
          "time": "03:36:00 WAT",
          "gps": "6.5244, 3.3792",
          "accuracy": "±12m",
          "reporter": "Anonymous-inc1",
          "sessionId": "session-1",
        },
        connectionStatus: "Connected",
      ).copyWithFallbackGps(gps: "6.5244, 3.3792", accuracy: "±12m");

      expect(overlay.connectionStatus, "Connected");
      expect(overlay.incidentId, "incident-1");
      expect(overlay.gps, "6.5244, 3.3792");
    });

    test("handles stream termination state as disconnected", () {
      expect(liveVideoConnectionLabel(LiveVideoConnectionState.disconnected),
          "Disconnected");
    });
  });
}
