import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/design_system/eye_semantic_colors.dart";
import "package:the_eye_mobile/emergency/incident_communication_contract.dart";
import "package:the_eye_mobile/emergency/widgets/communication_composer.dart";
import "package:the_eye_mobile/emergency/widgets/communication_header.dart";
import "package:the_eye_mobile/emergency/widgets/communication_live_rail.dart";
import "package:the_eye_mobile/emergency/widgets/communication_message_card.dart";
import "package:the_eye_mobile/emergency/widgets/communication_tabs.dart";

Widget _wrap(Widget child) {
  return MaterialApp(
    theme: ThemeData(
      brightness: Brightness.dark,
      extensions: const [EyeSemanticColors.dark],
    ),
    home: Scaffold(body: child),
  );
}

void main() {
  testWidgets("communication header shows back and subtitle", (tester) async {
    await tester.pumpWidget(
      _wrap(
        CommunicationHeader(
          title: "Communication",
          subtitle: "EYE-260811-D1B6 · Trans-Amadi",
          onBack: () {},
        ),
      ),
    );
    expect(find.text("Communication"), findsOneWidget);
    expect(find.textContaining("EYE-260811-D1B6"), findsOneWidget);
    expect(find.byTooltip("Back"), findsOneWidget);
  });

  testWidgets("live rail remains factual", (tester) async {
    await tester.pumpWidget(
      _wrap(
        CommunicationLiveRail(
          reportedAt: DateTime(2026, 8, 11, 20, 23),
        ),
      ),
    );
    expect(find.text("Emergency live"), findsOneWidget);
    expect(
      find.text("Overview still updating in the background"),
      findsOneWidget,
    );
  });

  testWidgets("tabs expose All Mine Responders", (tester) async {
    var current = CommunicationThreadTab.all;
    await tester.pumpWidget(
      _wrap(
        StatefulBuilder(
          builder: (context, setState) {
            return CommunicationTabs(
              value: current,
              onChanged: (tab) => setState(() => current = tab),
            );
          },
        ),
      ),
    );
    expect(find.text("All"), findsOneWidget);
    expect(find.text("Mine"), findsOneWidget);
    expect(find.text("Responders"), findsOneWidget);
    await tester.tap(find.text("Mine"));
    await tester.pump();
    expect(current, CommunicationThreadTab.mine);
  });

  testWidgets("message card uses citizen receipt labels", (tester) async {
    await tester.pumpWidget(
      _wrap(
        CommunicationMessageCard(
          message: IncidentThreadMessage(
            id: "m1",
            messageType: "Text",
            body: "Responders are on the way.",
            senderRole: "Agency",
            senderLabel: "Rivers State EMA",
            createdAt: DateTime(2026, 8, 11, 20, 27),
            deliveryState: "Read",
          ),
        ),
      ),
    );
    expect(find.text("TEXT UPDATE"), findsOneWidget);
    expect(find.text("Seen"), findsOneWidget);
    expect(find.textContaining("Seen by"), findsNothing);
    expect(find.textContaining("11111111"), findsNothing);
  });

  testWidgets("composer matches artifact controls", (tester) async {
    final controller = TextEditingController();
    await tester.pumpWidget(
      _wrap(
        CommunicationComposer(
          controller: controller,
          enabled: true,
          sending: false,
          canSendText: true,
          canSendPhoto: true,
          canSendVoice: true,
          onSend: () {},
          onAttach: () {},
          onPhoto: () {},
          onVoice: () {},
        ),
      ),
    );
    expect(find.text("Type a message..."), findsOneWidget);
    expect(find.byTooltip("Add attachment"), findsOneWidget);
    expect(find.byTooltip("Send photo"), findsOneWidget);
    expect(find.byTooltip("Send voice message"), findsOneWidget);
    expect(find.bySemanticsLabel("Send message"), findsOneWidget);
  });

  testWidgets("queued offline state is visible on card", (tester) async {
    await tester.pumpWidget(
      _wrap(
        CommunicationMessageCard(
          queued: true,
          message: IncidentThreadMessage(
            id: "q1",
            messageType: "Text",
            body: "Queued note",
            senderRole: "Reporter",
            senderLabel: "You",
            createdAt: DateTime(2026, 8, 11, 20, 30),
            deliveryState: "Queued",
          ),
        ),
      ),
    );
    expect(find.text("Queued offline"), findsOneWidget);
  });
}
