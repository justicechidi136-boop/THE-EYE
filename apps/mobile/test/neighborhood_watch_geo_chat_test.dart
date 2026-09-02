import "dart:io";

import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:flutter_test/flutter_test.dart";
import "package:permission_handler/permission_handler.dart";
import "package:the_eye_mobile/design_system/eye_semantic_colors.dart";
import "package:the_eye_mobile/evidence/evidence_capture_controller.dart";
import "package:the_eye_mobile/evidence/evidence_capture_service.dart";
import "package:the_eye_mobile/evidence/evidence_compressor.dart";
import "package:the_eye_mobile/evidence/evidence_media_source.dart";
import "package:the_eye_mobile/evidence/evidence_permission_service.dart";
import "package:the_eye_mobile/neighborhood_watch/geo_community_chat_view.dart";
import "package:the_eye_mobile/neighborhood_watch/neighborhood_watch_service.dart";

void main() {
  Widget buildChat({
    required Future<void> Function() onSend,
    TextEditingController? messageController,
    String? pendingMessage,
    String? sendError,
    VoidCallback? onBack,
    EvidenceCaptureController? evidenceController,
    VoidCallback? onToggleAttachments,
    bool showAttachments = false,
    List<CommunityPostItem> messages = const [],
  }) {
    final theme = ThemeData.light().copyWith(
      extensions: const [EyeSemanticColors.light],
    );
    return MaterialApp(
      theme: theme,
      home: GeoCommunityChatView(
        title: "Ikeja Neighborhood Watch",
        messages: messages,
        canSend: true,
        loading: false,
        showAttachments: showAttachments,
        sending: false,
        attachmentCount: 0,
        messageController: messageController ?? TextEditingController(),
        evidenceController: evidenceController,
        pendingMessage: pendingMessage,
        sendError: sendError,
        onRefresh: () async {},
        onLoadOlder: () async {},
        hasOlderMessages: false,
        loadingOlderMessages: false,
        onToggleAttachments: onToggleAttachments ?? () {},
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
    expect(
      find.byTooltip("Add photo, video, GIF, sticker, or voice note"),
      findsOneWidget,
    );

    await tester.enterText(find.byType(TextField), "Hello neighbors");
    await tester.pump();
    await tester.tap(find.byTooltip("Send message"));
    await tester.pump();
    expect(sends, 1);
  });

  testWidgets(
      "composer uses native emoji and keeps GIFs and stickers under add",
      (tester) async {
    final controller = TextEditingController();
    addTearDown(controller.dispose);
    final evidence = _evidenceController();
    addTearDown(evidence.dispose);
    await tester.pumpWidget(buildChat(
      onSend: () async {},
      messageController: controller,
      evidenceController: evidence,
      showAttachments: true,
    ));

    final textField = tester.widget<TextField>(find.byType(TextField));
    expect(textField.autocorrect, isTrue);
    expect(textField.enableSuggestions, isTrue);
    expect(textField.spellCheckConfiguration, isNotNull);
    expect(textField.contentInsertionConfiguration, isNotNull);
    expect(
      textField.contentInsertionConfiguration!.allowedMimeTypes,
      ["image/gif"],
    );
    expect(find.byKey(const Key("chat-expression-button")), findsNothing);
    expect(find.byKey(const Key("chat-attachment-button")), findsOneWidget);
    expect(find.byKey(const Key("chat-gif-sticker-button")), findsOneWidget);

    await tester.enterText(find.byType(TextField), "😀");
    await tester.pump();
    expect(controller.text, "😀");

    await tester.tap(find.byKey(const Key("chat-gif-sticker-button")));
    await tester.pumpAndSettle();

    expect(find.text("Emoji"), findsNothing);
    expect(find.text("GIF"), findsOneWidget);
    expect(find.text("Stickers"), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text("Blush"), findsOneWidget);
    expect(find.byType(Image), findsWidgets);
    expect(find.text("Choose GIF from device"), findsOneWidget);

    await tester.tap(find.text("Stickers"));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    await tester.tap(find.text("Stay safe"));
    await tester.pumpAndSettle();
    expect(controller.text, "😀🛡️✅");
  });

  testWidgets("empty composer opens the inline live voice-message recorder",
      (tester) async {
    final evidence = _evidenceController();
    addTearDown(evidence.dispose);
    await tester.pumpWidget(buildChat(
      onSend: () async {},
      evidenceController: evidence,
    ));

    await tester.tap(find.byTooltip("Record voice message"));
    await tester.pump();

    expect(find.byKey(const Key("chat-voice-composer")), findsOneWidget);
    expect(find.byType(TextField), findsNothing);
    expect(find.byTooltip("Cancel voice message"), findsOneWidget);
    expect(find.byTooltip("Send voice message"), findsOneWidget);
  });

  testWidgets("received voice note renders a compact replay control",
      (tester) async {
    const voice = CommunityPostMediaReference(
      id: "media-1",
      mediaType: "Audio",
      bucket: "private",
      objectKey: "community/post-1/voice.m4a",
      contentType: "audio/mp4",
      fileHash: "hash",
      signedGetUrl: "https://media.test/voice.m4a",
      durationSeconds: 9,
    );
    await tester.pumpWidget(buildChat(
      onSend: () async {},
      messages: const [
        CommunityPostItem(
          id: "post-1",
          title: "Neighborhood voice",
          body: "",
          type: "Discussion",
          verificationStatus: "PendingVerification",
          confidenceScore: 0,
          createdAt: null,
          authorName: "Amina",
          media: [voice],
        ),
      ],
    ));

    expect(find.byKey(const Key("chat-voice-message-bubble")), findsOneWidget);
    expect(find.byTooltip("Play neighborhood voice note"), findsOneWidget);
    expect(find.text("00:09"), findsOneWidget);
    final voiceBubble =
        tester.getSize(find.byKey(const Key("chat-voice-message-bubble")));
    expect(voiceBubble.width, 232);
    expect(voiceBubble.height, 44);
  });

  testWidgets("text messages stay compact at phone width", (tester) async {
    await tester.pumpWidget(buildChat(
      onSend: () async {},
      messages: const [
        CommunityPostItem(
          id: "post-compact",
          title: "Short update",
          body: "Road is clear now.",
          type: "Discussion",
          verificationStatus: "PendingVerification",
          confidenceScore: 0,
          createdAt: null,
          authorName: "Amina",
        ),
      ],
    ));

    final bubbleConstraint = tester
        .widgetList<ConstrainedBox>(
          find.descendant(
            of: find.byType(RoomMessageBubble),
            matching: find.byType(ConstrainedBox),
          ),
        )
        .firstWhere((widget) => widget.constraints.maxWidth <= 286);
    expect(bubbleConstraint.constraints.maxWidth, lessThanOrEqualTo(286));
  });

  testWidgets("message footer keeps Like left and time right", (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: RoomMessageBubble(
            body: "Road is clear now.",
            author: "Amina",
            ownMessage: false,
            time: DateTime(2026, 9, 2, 12, 7),
          ),
        ),
      ),
    );

    expect(find.text("Like"), findsOneWidget);
    expect(find.text("12:07"), findsOneWidget);
    final likePosition = tester.getCenter(find.text("Like"));
    final timePosition = tester.getCenter(find.text("12:07"));
    expect(likePosition.dx, lessThan(timePosition.dx));
    expect((likePosition.dy - timePosition.dy).abs(), lessThan(8));
  });

  testWidgets("Android keyboard GIF enters the private attachment pipeline",
      (tester) async {
    final tempDir = Directory.systemTemp.createTempSync("eye-keyboard-gif-");
    addTearDown(() {
      if (tempDir.existsSync()) tempDir.deleteSync(recursive: true);
    });
    final evidence = _evidenceController(tempDir: tempDir);
    addTearDown(evidence.dispose);
    var attachmentPanelToggles = 0;
    await tester.pumpWidget(buildChat(
      onSend: () async {},
      evidenceController: evidence,
      onToggleAttachments: () => attachmentPanelToggles += 1,
    ));

    final textField = tester.widget<TextField>(find.byType(TextField));
    await tester.runAsync(() async {
      textField.contentInsertionConfiguration!.onContentInserted(
        KeyboardInsertedContent(
          mimeType: "image/gif",
          uri: "content://keyboard/reaction.gif",
          data: Uint8List.fromList([
            0x47,
            0x49,
            0x46,
            0x38,
            0x39,
            0x61,
            ...List<int>.filled(64, 0x00),
          ]),
        ),
      );
      await Future<void>.delayed(const Duration(milliseconds: 20));
      for (var attempt = 0; attempt < 100 && evidence.busy; attempt += 1) {
        await Future<void>.delayed(const Duration(milliseconds: 20));
      }
    });
    await tester.pump();

    expect(
      evidence.attachments,
      hasLength(1),
      reason: "lastError=${evidence.lastError}; busy=${evidence.busy}",
    );
    expect(evidence.attachments.single.contentType, "image/gif");
    expect(attachmentPanelToggles, 1);
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

EvidenceCaptureController _evidenceController({Directory? tempDir}) {
  return EvidenceCaptureController(
    captureService: EvidenceCaptureService(
      compressor: InMemoryEvidenceCompressor(),
      documentsDirectoryProvider: tempDir == null ? null : () async => tempDir,
    ),
    mediaSource: FakeEvidenceMediaSource(),
    permissionService: EvidencePermissionService(
      checkPermission: (_) async => PermissionStatus.granted,
      requestPermission: (_) async => PermissionStatus.granted,
    ),
  );
}
