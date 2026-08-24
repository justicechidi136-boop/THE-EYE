import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/design_system/eye_semantic_colors.dart";
import "package:the_eye_mobile/neighborhood_watch/geo_community_chat_view.dart";

void main() {
  Widget buildChat({
    required Future<void> Function() onSend,
    String? pendingMessage,
    String? sendError,
  }) {
    final theme = ThemeData.light().copyWith(
      extensions: const [EyeSemanticColors.light],
    );
    return MaterialApp(
      theme: theme,
      home: GeoCommunityChatView(
        title: "Ikeja Neighborhood Watch",
        messages: const [],
        canSend: true,
        loading: false,
        showAttachments: false,
        sending: false,
        attachmentCount: 0,
        messageController: TextEditingController(),
        evidenceController: null,
        pendingMessage: pendingMessage,
        sendError: sendError,
        onRefresh: () async {},
        onLoadOlder: () async {},
        hasOlderMessages: false,
        loadingOlderMessages: false,
        onToggleAttachments: () {},
        onSend: onSend,
        onOpenMessage: (_) {},
        onReply: (_) {},
        onLike: (_) {},
        onCancelReply: () {},
      ),
    );
  }

  testWidgets("empty geographic room keeps the first-message composer active",
      (tester) async {
    var sends = 0;
    await tester.pumpWidget(buildChat(onSend: () async => sends += 1));

    expect(find.text("No conversations here yet"), findsOneWidget);
    expect(
      find.text("Be the first to start a conversation in your neighborhood."),
      findsOneWidget,
    );
    expect(find.byType(TextField), findsOneWidget);
    expect(find.text("Message your neighborhood..."), findsOneWidget);
    expect(find.byTooltip("Add photo, video, or voice note"), findsOneWidget);

    await tester.enterText(find.byType(TextField), "Hello neighbors");
    await tester.tap(find.byTooltip("Send message"));
    await tester.pump();
    expect(sends, 1);
  });

  testWidgets("failed first message stays visible and can be retried",
      (tester) async {
    var retries = 0;
    await tester.pumpWidget(buildChat(
      onSend: () async => retries += 1,
      pendingMessage: "Network-safe pending message",
      sendError: "Unable to send. Check your connection.",
    ));

    expect(find.text("Network-safe pending message"), findsOneWidget);
    expect(find.text("failed"), findsOneWidget);
    await tester.tap(find.text("Retry"));
    await tester.pump();
    expect(retries, 1);
  });
}
