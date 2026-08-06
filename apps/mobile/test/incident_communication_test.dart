import "package:flutter_test/flutter_test.dart";

import "package:the_eye_mobile/emergency/incident_communication_contract.dart";

void main() {
  test("parses communication summary from active emergency block", () {
    final summary = IncidentCommunicationSummary.fromJson({
      "conversationAvailable": true,
      "unreadMessageCount": 2,
      "lastMessagePreview": "Dispatcher update",
      "conversationStatus": "Active",
      "allowedCommunicationActions": {
        "sendText": true,
        "sendVoice": true,
        "sendPhoto": true,
        "sendVideo": false,
        "sendLocation": true,
        "quickReply": true,
        "openThread": true,
      },
    });
    expect(summary.unreadMessageCount, 2);
    expect(summary.allowedCommunicationActions.sendVideo, isFalse);
  });

  test("queued message round-trips json", () {
    final original = QueuedIncidentMessage(
      clientMessageId: "client-1",
      incidentId: "inc-1",
      messageType: "Text",
      body: "Offline hello",
      createdAt: DateTime.utc(2026, 8, 8),
    );
    final restored = QueuedIncidentMessage.fromJson(original.toJson());
    expect(restored.clientMessageId, "client-1");
    expect(restored.state, QueuedMessageState.queued);
  });
}
