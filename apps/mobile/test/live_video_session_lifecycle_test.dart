import "package:flutter_test/flutter_test.dart";
import "package:permission_handler/permission_handler.dart";

import "package:the_eye_mobile/evidence/evidence_permission_service.dart";
import "package:the_eye_mobile/live_video/live_video_api_models.dart";
import "package:the_eye_mobile/live_video/live_video_disconnect_source.dart";
import "package:the_eye_mobile/live_video/live_video_lifecycle_phase.dart";
import "package:the_eye_mobile/live_video/live_video_session_controller.dart";

LiveVideoStartResult _minimalStartResult({String sessionId = "session-test"}) {
  return LiveVideoStartResult.fromResponse({
    "data": {
      "id": sessionId,
      "incidentId": "incident-1",
      "roomName": "eye-incident-incident-1",
      "correlationId": "corr-$sessionId",
      "participantIdentity": "user-user-1",
    },
    "connection": {
      "serverUrl": "wss://staging-livekit.example.com",
      "participantToken":
          "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjk5OTk5OTk5OTl9.signature",
      "participantIdentity": "user-user-1",
      "roomName": "eye-incident-incident-1",
    },
  });
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Future<void> tearDownController(LiveVideoSessionController controller) async {
    await controller.stopSession(caller: "test:teardown");
  }

  group("LiveVideoSessionController lifecycle guards", () {
    test("double stop is idempotent", () async {
      final controller = LiveVideoSessionController();

      controller.debugForceLifecycle(LiveVideoLifecyclePhase.stopped);
      await controller.stopSession(
        keepPreview: false,
        reason: LiveVideoDisconnectReason.userStop,
        caller: "test:stop1",
      );
      await controller.stopSession(
        reason: LiveVideoDisconnectReason.userStop,
        caller: "test:stop2",
      );
      expect(controller.lifecyclePhase, LiveVideoLifecyclePhase.idle);
      await tearDownController(controller);
      controller.dispose();
    });

    test("start blocked when lifecycle disallows overlapping sessions", () async {
      final controller = LiveVideoSessionController();

      controller.debugForceLifecycle(LiveVideoLifecyclePhase.connecting);
      expect(controller.canStartSession, isFalse);

      final blocked = await controller.startSession(
        _minimalStartResult(),
        incidentIdOverride: "incident-1",
      );
      expect(blocked, isFalse);
      await tearDownController(controller);
      controller.dispose();
    });

    test("preview blocked during active connecting lifecycle", () async {
      final controller = LiveVideoSessionController();

      controller.debugForceLifecycle(LiveVideoLifecyclePhase.connecting);
      final previewOk = await controller.startLocalPreview();
      expect(previewOk, isFalse);
      await tearDownController(controller);
      controller.dispose();
    });

    test(
        "preview does not abort solely because preparing disallows start",
        () async {
      // Regression: startLocalPreview used to transition to preparing, then
      // return false because preparing.allowsStart is false — blocking SOS video.
      expect(LiveVideoLifecyclePhase.preparing.allowsStart, isFalse);

      final controller = LiveVideoSessionController(
        permissionService: EvidencePermissionService(
          checkPermission: (_) async => PermissionStatus.granted,
          requestPermission: (_) async => PermissionStatus.granted,
        ),
      );

      await controller.startLocalPreview();
      expect(
        controller.lifecyclePhase,
        isNot(LiveVideoLifecyclePhase.preparing),
        reason:
            "must leave preparing (success → stopped, or failure → connectFailed)",
      );
      await tearDownController(controller);
      controller.dispose();
    });

    test("stop blocks start while lifecycle is stopping", () async {
      final controller = LiveVideoSessionController();
      controller.debugForceLifecycle(LiveVideoLifecyclePhase.stopping);
      expect(controller.canStartSession, isFalse);
      final startResult = await controller.startSession(
        _minimalStartResult(),
        incidentIdOverride: "incident-1",
      );
      expect(startResult, isFalse);
      controller.debugForceLifecycle(LiveVideoLifecyclePhase.stopped);
      await tearDownController(controller);
      controller.dispose();
    });

    test("each debugBeginAttempt assigns unique connectionAttemptId", () {
      final controller = LiveVideoSessionController();

      final first = controller.debugBeginAttempt(incidentIdOverride: "inc-1");
      final second = controller.debugBeginAttempt(incidentIdOverride: "inc-1");
      expect(first, isNot(second));
      expect(controller.debugIsAttemptActive(second), isTrue);
      expect(controller.debugIsAttemptActive(first), isFalse);
      controller.dispose();
    });

    test("stale attempt ignored after superseded", () {
      final controller = LiveVideoSessionController();

      final stale = controller.debugBeginAttempt();
      final active = controller.debugBeginAttempt();
      expect(controller.debugIsAttemptActive(stale), isFalse);
      expect(controller.debugIsAttemptActive(active), isTrue);
      controller.dispose();
    });

    test("widget dispose completes without throw", () async {
      final controller = LiveVideoSessionController();
      controller.debugForceLifecycle(LiveVideoLifecyclePhase.stopped);
      controller.dispose();
      await Future<void>.delayed(const Duration(milliseconds: 20));
      expect(controller.lifecyclePhase, isA<LiveVideoLifecyclePhase>());
    });
  });
}
