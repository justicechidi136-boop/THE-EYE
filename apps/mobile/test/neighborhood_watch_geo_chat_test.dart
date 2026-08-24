import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/design_system/eye_semantic_colors.dart";
import "package:the_eye_mobile/neighborhood_watch/geo_community_chat_view.dart";

void main() {
  Widget buildChat({
    required Future<void> Function() onSend,
    TextEditingController? messageController,
    String? pendingMessage,
    String? sendError,
    VoidCallback? onBack,
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
        messageController: messageController ?? TextEditingController(),
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
        onBack: onBack,
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

  testWidgets("composer offers emoji, GIF, and sticker controls",
      (tester) async {
    final controller = TextEditingController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(buildChat(
      onSend: () async {},
      messageController: controller,
    ));

    await tester.tap(find.byTooltip("Emoji, GIF, and stickers"));
    await tester.pumpAndSettle();

    expect(find.text("Emoji"), findsOneWidget);
    expect(find.text("GIF"), findsOneWidget);
    expect(find.text("Stickers"), findsOneWidget);

    await tester.tap(find.byTooltip("Insert 😀"));
    await tester.pump();
    expect(controller.text, "😀");

    await tester.tap(find.text("GIF"));
    await tester.pumpAndSettle();
    expect(find.text("Choose GIF"), findsOneWidget);

    await tester.tap(find.text("Stickers"));
    await tester.pumpAndSettle();
    await tester.tap(find.text("Stay safe"));
    await tester.pumpAndSettle();
    expect(controller.text, "😀🛡️✅");
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

  testWidgets("keyboard keeps composer and latest message above its inset",
      (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    tester.view.viewInsets = const FakeViewPadding(bottom: 320);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetViewInsets);

    await tester.pumpWidget(buildChat(
      onSend: () async {},
      pendingMessage: "Message remains visible",
    ));
    await tester.pumpAndSettle();

    const keyboardTop = 844.0 - 320.0;
    expect(tester.getBottomRight(find.byType(TextField)).dy,
        lessThanOrEqualTo(keyboardTop));
    expect(tester.getBottomRight(find.text("Message remains visible")).dy,
        lessThanOrEqualTo(keyboardTop));
  });

  testWidgets("Android back returns through the Neighborhood Watch callback",
      (tester) async {
    var backCalls = 0;
    await tester.pumpWidget(buildChat(
      onSend: () async {},
      onBack: () => backCalls += 1,
    ));

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();

    expect(backCalls, 1);
    expect(find.text("No conversations here yet"), findsOneWidget);
  });
}
