import "package:flutter_test/flutter_test.dart";

import "package:the_eye_mobile/live_video/live_video_api_models.dart";
import "package:the_eye_mobile/live_video/live_video_connection_state.dart";
import "package:the_eye_mobile/live_video/live_video_evidence_overlay.dart";
import "package:the_eye_mobile/live_video/live_video_start_validation.dart";

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
          "token": "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjk5OTk5OTk5OTl9.signature",
        },
      });

      expect(result.sessionId, "session-1");
      expect(result.livekit.isValid, isTrue);
      expect(result.recordingConfigured, isFalse);
      expect(result.evidenceOverlay?["incidentId"], "incident-1");
    });

    test("parses livekit credentials nested under data", () {
      final result = LiveVideoStartResult.fromResponse({
        "data": {
          "id": "session-2",
          "incidentId": "incident-2",
          "roomName": "eye-incident-incident-2",
          "livekit": {
            "url": "wss://livekit.example",
            "roomName": "eye-incident-incident-2",
            "token": "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjk5OTk5OTk5OTl9.signature",
          },
        },
      });

      expect(result.livekit.isValid, isTrue);
      expect(result.livekit.token,
          "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjk5OTk5OTk5OTl9.signature");
    });

    test("parses connection object from start response", () {
      final result = LiveVideoStartResult.fromResponse({
        "data": {
          "id": "session-3",
          "incidentId": "incident-3",
          "roomName": "eye-incident-incident-3",
          "correlationId": "corr-3",
          "participantIdentity": "user-user-3",
        },
        "connection": {
          "serverUrl": "wss://staging-livekit.theeye.com.ng",
          "participantToken": "header.payload.signature",
          "participantIdentity": "user-user-3",
          "roomName": "eye-incident-incident-3",
          "expiresAt": "2099-01-01T00:00:00.000Z",
        },
      });

      expect(result.livekit.isValid, isTrue);
      expect(result.correlationId, "corr-3");
      expect(result.livekit.url, "wss://staging-livekit.theeye.com.ng");
    });

    test("fails explicitly when server URL missing", () {
      expect(
        () => LiveVideoStartResult.fromResponse({
          "data": {"id": "session-4", "roomName": "room-4"},
          "livekit": {"token": "a.b.c", "roomName": "room-4"},
        }),
        throwsA(isA<LiveVideoStartValidationException>().having(
          (error) => error.reason,
          "reason",
          LiveVideoStartValidationReason.urlMissing,
        )),
      );
    });

    test("fails explicitly when token missing", () {
      expect(
        () => LiveVideoStartResult.fromResponse({
          "data": {"id": "session-5", "roomName": "room-5"},
          "livekit": {
            "url": "wss://staging-livekit.theeye.com.ng",
            "roomName": "room-5",
          },
        }),
        throwsA(isA<LiveVideoStartValidationException>().having(
          (error) => error.reason,
          "reason",
          LiveVideoStartValidationReason.tokenMissing,
        )),
      );
    });

    test("fails explicitly when token malformed", () {
      expect(
        () => LiveVideoStartResult.fromResponse({
          "data": {"id": "session-6", "roomName": "room-6"},
          "livekit": {
            "url": "wss://staging-livekit.theeye.com.ng",
            "roomName": "room-6",
            "token": "not-a-jwt",
          },
        }),
        throwsA(isA<LiveVideoStartValidationException>().having(
          (error) => error.reason,
          "reason",
          LiveVideoStartValidationReason.tokenMalformed,
        )),
      );
    });

    test("maps token failure without leaking secrets", () {
      final message = mapLiveVideoApiError(
          403, "Forbidden room access for token abc-secret");
      expect(message, contains("not authorized"));
      expect(message, isNot(contains("abc-secret")));
    });

    test("maps server gateway failures to LIVE-VIDEO-009", () {
      final message = mapLiveVideoApiError(
          502, "THE EYE servers could not process your report (ERR-INC-502).");
      expect(message, contains("LIVE-VIDEO-009"));
      expect(message, contains("emergency may still have been submitted"));
      expect(message, isNot(contains("ERR-INC-502")));
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
