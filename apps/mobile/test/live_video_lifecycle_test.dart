import "package:flutter_test/flutter_test.dart";

import "package:the_eye_mobile/contracts/the_eye_payloads.dart";
import "package:the_eye_mobile/live_video/live_video_connection_attempt.dart";
import "package:the_eye_mobile/live_video/live_video_connection_state.dart";
import "package:the_eye_mobile/live_video/live_video_lifecycle_phase.dart";
import "package:the_eye_mobile/live_video/live_video_operation_lock.dart";
import "package:the_eye_mobile/live_video/live_video_stop_routing.dart";

void main() {
  group("LiveVideoLifecycleStateMachine", () {
    test("allows idle -> preparing -> connecting -> streaming path", () {
      final machine = LiveVideoLifecycleStateMachine();
      expect(machine.tryTransition(LiveVideoLifecyclePhase.preparing), isTrue);
      expect(machine.tryTransition(LiveVideoLifecyclePhase.connecting), isTrue);
      expect(machine.tryTransition(LiveVideoLifecyclePhase.connected), isTrue);
      expect(machine.tryTransition(LiveVideoLifecyclePhase.publishing), isTrue);
      expect(machine.tryTransition(LiveVideoLifecyclePhase.streaming), isTrue);
      expect(machine.tryTransition(LiveVideoLifecyclePhase.stopping), isTrue);
      expect(machine.tryTransition(LiveVideoLifecyclePhase.stopped), isTrue);
      expect(machine.tryTransition(LiveVideoLifecyclePhase.idle), isTrue);
    });

    test("blocks start during active phases", () {
      expect(LiveVideoLifecyclePhase.preparing.allowsStart, isTrue);
      expect(LiveVideoLifecyclePhase.connecting.allowsStart, isFalse);
      expect(LiveVideoLifecyclePhase.publishing.allowsStart, isFalse);
      expect(LiveVideoLifecyclePhase.stopping.allowsStart, isFalse);
      expect(LiveVideoLifecyclePhase.stopped.allowsStart, isTrue);
      expect(LiveVideoLifecyclePhase.connectFailed.allowsStart, isTrue);
    });

    test("maps streaming to connected UI state", () {
      expect(
        LiveVideoLifecyclePhase.streaming.toConnectionState(),
        LiveVideoConnectionState.connected,
      );
      expect(
        LiveVideoLifecyclePhase.stopped.toConnectionState(previewActive: true),
        LiveVideoConnectionState.previewing,
      );
    });
  });

  group("LiveVideoAttemptFactory", () {
    test("creates unique attempt ids and increments generation", () {
      final factory = LiveVideoAttemptFactory();
      final first = factory.create(incidentId: "inc-1");
      final second = factory.create(incidentId: "inc-1");
      expect(first.connectionAttemptId, isNot(second.connectionAttemptId));
      expect(
          second.controllerGeneration, greaterThan(first.controllerGeneration));
      expect(factory.controllerGeneration, second.controllerGeneration);
    });
  });

  group("LiveVideoOperationLock", () {
    test("serializes overlapping operations", () async {
      final lock = LiveVideoOperationLock();
      final order = <String>[];

      final first = lock.run(() async {
        order.add("first-start");
        await Future<void>.delayed(const Duration(milliseconds: 30));
        order.add("first-end");
      });
      final second = lock.run(() async {
        order.add("second-start");
        await Future<void>.delayed(const Duration(milliseconds: 5));
        order.add("second-end");
      });

      await Future.wait([first, second]);
      expect(order, [
        "first-start",
        "first-end",
        "second-start",
        "second-end",
      ]);
    });

    test("start waits for previous stop future pattern", () async {
      final lock = LiveVideoOperationLock();
      Future<void>? lastStop;

      Future<bool> start() async {
        await (lastStop ?? Future<void>.value());
        return lock.run(() async => true);
      }

      lastStop = lock.run(() async {
        await Future<void>.delayed(const Duration(milliseconds: 20));
      });
      final startFuture = start();
      await startFuture;
      await lock.settled;
    });
  });

  group("LiveVideoConnectionAttempt", () {
    test("diagnostic map omits raw token", () {
      final attempt = LiveVideoConnectionAttempt(
        connectionAttemptId: "lv-test-1",
        controllerGeneration: 3,
        startedAt: DateTime.utc(2026, 8, 5),
        tokenFingerprint: "fp-abc",
      );
      final map = attempt.toDiagnosticMap();
      expect(map["connectionAttemptId"], "lv-test-1");
      expect(map["tokenFingerprint"], "fp-abc");
      expect(map.containsKey("token"), isFalse);
    });
  });

  group("LiveVideoStopRoutingDecision", () {
    test("standalone start payload declares terminal lifecycle ownership", () {
      final payload = TheEyePayloads.liveVideoStart(
        standaloneEmergency: true,
      );
      expect(payload["standaloneEmergency"], isTrue);
    });

    test("standalone stop routes to active emergency when incident exists", () {
      final decision = resolveLiveVideoStopRouting(
        returnToActiveEmergency: false,
        activeIncidentId: "inc-123",
      );
      expect(
          decision.destination, LiveVideoStopDestination.openActiveEmergency);
      expect(decision.incidentId, "inc-123");
      expect(decision.shouldPreserveIncidentId, isTrue);
    });

    test("standalone live emergency stop routes to its archive", () {
      final decision = resolveLiveVideoStopRouting(
        returnToActiveEmergency: false,
        activeIncidentId: "inc-archive",
        incidentArchived: true,
      );
      expect(
          decision.destination, LiveVideoStopDestination.openIncidentArchive);
      expect(decision.incidentId, "inc-archive");
    });

    test("reads the server-authoritative archived incident result", () {
      expect(
        liveVideoStopArchivedIncident({
          "incident": {"id": "inc-archive", "archived": true},
        }),
        isTrue,
      );
      expect(liveVideoStopArchivedIncident(const {}), isFalse);
    });

    test("active-emergency stop returns to active emergency route", () {
      final decision = resolveLiveVideoStopRouting(
        returnToActiveEmergency: true,
        activeIncidentId: "inc-456",
      );
      expect(decision.destination,
          LiveVideoStopDestination.returnToActiveEmergency);
      expect(decision.incidentId, "inc-456");
      expect(decision.shouldPreserveIncidentId, isTrue);
    });

    test("standalone stop with no incident stays on live video", () {
      final decision = resolveLiveVideoStopRouting(
        returnToActiveEmergency: false,
        activeIncidentId: " ",
      );
      expect(decision.destination, LiveVideoStopDestination.stayOnLiveVideo);
      expect(decision.incidentId, isNull);
      expect(decision.shouldPreserveIncidentId, isFalse);
    });
  });
}
