import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_watch/services/push_message_router.dart';

void main() {
  group('PushMessageRouter', () {
    test('allows watch-safe categories only', () {
      expect(PushMessageRouter.isWatchCategory('FamilySosAlert'), isTrue);
      expect(PushMessageRouter.isWatchCategory('EmergencyAlert'), isTrue);
      expect(PushMessageRouter.isWatchCategory('IncidentChatMessage'), isFalse);
      expect(PushMessageRouter.isWatchCategory(null), isFalse);
    });

    test('ignores non-watch categories in dispatch', () async {
      var handled = false;
      PushMessageRouter.onAlert = ({
        required String title,
        required String body,
        String? incidentId,
        String? notificationId,
        String priority = 'High',
        String category = WatchPushCategories.emergencyAlert,
      }) async {
        handled = true;
      };

      await PushMessageRouter.handleForeground(
        RemoteMessage(data: const {'type': 'IncidentChatMessage'}),
      );
      expect(handled, isFalse);

      await PushMessageRouter.handleForeground(
        RemoteMessage(
          data: const {
            'type': 'FamilySosAlert',
            'title': 'Family SOS',
            'body': 'Help needed',
          },
        ),
      );
      expect(handled, isTrue);

      PushMessageRouter.onAlert = null;
    });
  });
}
