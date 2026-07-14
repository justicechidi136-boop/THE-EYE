import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_watch/models/pairing_state.dart';
import 'package:the_eye_watch/models/sos_event.dart';
import 'package:the_eye_watch/models/watch_app_flow.dart';

void main() {
  group('resolveWatchAppFlow', () {
    test('returns pairingRequired when not paired', () {
      expect(
        resolveWatchAppFlow(
          pairingPhase: PairingPhase.awaitingPhoneConfirmation,
          sosLifecycle: SosLifecycle.idle,
        ),
        WatchAppFlow.pairingRequired,
      );
    });

    test('returns sosCountdown during hold', () {
      expect(
        resolveWatchAppFlow(
          pairingPhase: PairingPhase.paired,
          sosLifecycle: SosLifecycle.holding,
        ),
        WatchAppFlow.sosCountdown,
      );
    });

    test('returns sosQueued on failed/offline submit', () {
      expect(
        resolveWatchAppFlow(
          pairingPhase: PairingPhase.paired,
          sosLifecycle: SosLifecycle.failed,
        ),
        WatchAppFlow.sosQueued,
      );
    });

    test('returns watchFaceDanger when area risk elevated', () {
      expect(
        resolveWatchAppFlow(
          pairingPhase: PairingPhase.paired,
          sosLifecycle: SosLifecycle.idle,
          areaDanger: true,
        ),
        WatchAppFlow.watchFaceDanger,
      );
    });

    test('incoming alert takes priority', () {
      expect(
        resolveWatchAppFlow(
          pairingPhase: PairingPhase.paired,
          sosLifecycle: SosLifecycle.countdown,
          hasIncomingAlert: true,
        ),
        WatchAppFlow.incomingAlert,
      );
    });
  });

  group('canTransitionWatchFlow', () {
    test('allows watch face to SOS countdown', () {
      expect(
        canTransitionWatchFlow(
          WatchAppFlow.watchFaceIdle,
          WatchAppFlow.sosCountdown,
        ),
        isTrue,
      );
    });

    test('blocks settings to SOS without hub', () {
      expect(
        canTransitionWatchFlow(
          WatchAppFlow.settingsRadius,
          WatchAppFlow.sosCountdown,
        ),
        isFalse,
      );
    });

    test('allows resolution chain', () {
      expect(
        canTransitionWatchFlow(
          WatchAppFlow.communityVote,
          WatchAppFlow.pushAreaCleared,
        ),
        isTrue,
      );
      expect(
        canTransitionWatchFlow(
          WatchAppFlow.incidentResolved,
          WatchAppFlow.notificationListResolved,
        ),
        isTrue,
      );
    });
  });
}
