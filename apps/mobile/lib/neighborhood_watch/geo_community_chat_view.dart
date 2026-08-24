import "dart:async";

import "package:flutter/material.dart";
import "package:flutter/services.dart";

import "../contracts/the_eye_enums.dart";
import "../design_system/eye_semantic_colors.dart";
import "../evidence/evidence_attachment_picker.dart";
import "../evidence/evidence_capture_controller.dart";
import "../voice/voice_recorder.dart";
import "neighborhood_watch_prototype_chrome.dart";
import "neighborhood_watch_service.dart";

const _chatEmojis = <String>[
  "😀",
  "😂",
  "😍",
  "👍",
  "🙏",
  "👏",
  "❤️",
  "🎉",
  "👀",
  "🤝",
  "✅",
  "🚨",
  "📍",
  "🏠",
  "🛡️",
  "💡",
  "⚠️",
  "🔥",
  "💬",
  "🙌",
];

const _chatStickers = <({String label, String value})>[
  (label: "Stay safe", value: "🛡️✅"),
  (label: "Alert", value: "🚨⚠️"),
  (label: "Watching", value: "👀🏠"),
  (label: "Thank you", value: "🙏❤️"),
  (label: "All clear", value: "✅🙌"),
  (label: "Neighbors", value: "🤝🏠"),
];

const _chatGifs = <({String label, String asset, String fileName})>[
  (
    label: "Blush",
    asset: "assets/gifs/blush.gif",
    fileName: "blush.gif",
  ),
  (
    label: "Laugh",
    asset: "assets/gifs/laugh.gif",
    fileName: "laugh.gif",
  ),
  (
    label: "Smile",
    asset: "assets/gifs/smile.gif",
    fileName: "smile.gif",
  ),
  (
    label: "Joy",
    asset: "assets/gifs/joy.gif",
    fileName: "joy.gif",
  ),
  (
    label: "Heart",
    asset: "assets/gifs/heart.gif",
    fileName: "heart.gif",
  ),
];

class GeoCommunityChatView extends StatelessWidget {
  const GeoCommunityChatView({
    required this.title,
    this.subtitle,
    required this.messages,
    required this.canSend,
    required this.loading,
    required this.showAttachments,
    required this.sending,
    required this.attachmentCount,
    required this.messageController,
    required this.evidenceController,
    required this.onRefresh,
    required this.onLoadOlder,
    required this.hasOlderMessages,
    required this.loadingOlderMessages,
    required this.onToggleAttachments,
    required this.onSend,
    required this.onOpenMessage,
    required this.onReply,
    required this.onLike,
    required this.onCancelReply,
    this.onBack,
    this.headerActions = const [],
    this.locationNotice,
    this.currentUserId,
    this.error,
    this.pendingMessage,
    this.sendError,
    this.replyTo,
    super.key,
  });

  final String title;
  final String? subtitle;
  final List<CommunityPostItem> messages;
  final bool canSend;
  final bool loading;
  final bool showAttachments;
  final bool sending;
  final int attachmentCount;
  final TextEditingController messageController;
  final EvidenceCaptureController? evidenceController;
  final Future<void> Function() onRefresh;
  final Future<void> Function() onLoadOlder;
  final bool hasOlderMessages;
  final bool loadingOlderMessages;
  final VoidCallback onToggleAttachments;
  final Future<void> Function() onSend;
  final ValueChanged<CommunityPostItem> onOpenMessage;
  final ValueChanged<CommunityPostItem> onReply;
  final ValueChanged<CommunityPostItem> onLike;
  final VoidCallback onCancelReply;
  final VoidCallback? onBack;
  final List<Widget> headerActions;
  final Widget? locationNotice;
  final String? currentUserId;
  final String? error;
  final String? pendingMessage;
  final String? sendError;
  final CommunityPostItem? replyTo;

  void _insertExpression(String value) {
    final text = messageController.text;
    final selection = messageController.selection;
    final start = selection.isValid ? selection.start : text.length;
    final end = selection.isValid ? selection.end : text.length;
    final next = text.replaceRange(start, end, value);
    messageController.value = TextEditingValue(
      text: next,
      selection: TextSelection.collapsed(offset: start + value.length),
    );
  }

  Future<void> _showExpressionPicker(BuildContext context) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => _ChatExpressionSheet(
        gifEnabled: canSend && evidenceController != null,
        onEmoji: _insertExpression,
        onSticker: (value) {
          _insertExpression(value);
          Navigator.of(sheetContext).pop();
        },
        onGif: () async {
          Navigator.of(sheetContext).pop();
          final before = evidenceController?.attachments.length ?? 0;
          await evidenceController?.pickGif();
          final after = evidenceController?.attachments.length ?? 0;
          if (after > before && !showAttachments) onToggleAttachments();
        },
        onGifAsset: (gif) async {
          Navigator.of(sheetContext).pop();
          final before = evidenceController?.attachments.length ?? 0;
          final data = await rootBundle.load(gif.asset);
          await evidenceController?.addBundledGif(
            fileName: gif.fileName,
            bytes: data.buffer.asUint8List(
              data.offsetInBytes,
              data.lengthInBytes,
            ),
          );
          final after = evidenceController?.attachments.length ?? 0;
          if (after > before && !showAttachments) onToggleAttachments();
        },
      ),
    );
  }

  Future<void> _showVoiceRecorder(BuildContext context) async {
    final controller = evidenceController;
    if (controller == null) return;
    final existingVoice = controller.attachments
        .where((item) => item.isAudio && item.metadata["voiceReport"] == true)
        .toList(growable: false);
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            16,
            8,
            16,
            16 + MediaQuery.viewInsetsOf(sheetContext).bottom,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      "Voice message",
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: "Close voice recorder",
                    onPressed: () => Navigator.of(sheetContext).pop(),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
              VoiceRecorder(
                enabled: canSend &&
                    !sending &&
                    (controller.canAddMoreFor(IncidentMediaType.audio) ||
                        existingVoice.isNotEmpty),
                onRecordingReady: (result) {
                  for (final existing in existingVoice) {
                    controller.remove(existing.localId);
                  }
                  controller.addVoiceAttachment(result.attachment);
                  Navigator.of(sheetContext).pop();
                  if (!showAttachments) onToggleAttachments();
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _insertKeyboardGif(
    BuildContext context,
    KeyboardInsertedContent content,
  ) async {
    final controller = evidenceController;
    if (controller == null || content.mimeType != "image/gif") return;
    final bytes = content.data;
    if (bytes == null || bytes.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            "Unable to read that keyboard GIF. Choose it from the GIF picker instead.",
          ),
        ),
      );
      return;
    }
    final before = controller.attachments.length;
    await controller.addGifBytes(
      fileName: "keyboard-${DateTime.now().millisecondsSinceEpoch}.gif",
      bytes: bytes,
    );
    if (!context.mounted) return;
    final after = controller.attachments.length;
    if (after > before && !showAttachments) {
      onToggleAttachments();
    } else if (after == before && controller.lastError != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(controller.lastError!)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    final scaffold = NwPrototypeScaffold(
      title: title,
      subtitle: subtitle,
      leading: onBack == null
          ? null
          : IconButton(
              tooltip: "Back to Neighborhood Watch",
              onPressed: onBack,
              icon: const Icon(Icons.arrow_back),
            ),
      actions: headerActions,
      body: LayoutBuilder(
        builder: (context, constraints) {
          final attachmentHeight =
              (constraints.maxHeight * 0.45).clamp(120.0, 330.0);
          return Column(
            children: [
              if (locationNotice != null) locationNotice!,
              Expanded(child: _conversation(context)),
              DecoratedBox(
                decoration: BoxDecoration(
                  color: semantics.elevatedSurface,
                  border: Border(top: BorderSide(color: semantics.divider)),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (replyTo != null) _replyPreview(context),
                    if (showAttachments && evidenceController != null)
                      ConstrainedBox(
                        constraints:
                            BoxConstraints(maxHeight: attachmentHeight),
                        child: SingleChildScrollView(
                          padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
                          child: EvidenceAttachmentPicker(
                            controller: evidenceController!,
                            lowDataMode: false,
                          ),
                        ),
                      ),
                    if (sendError != null) _failedSend(context),
                    _composer(context),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
    if (onBack == null) return scaffold;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) onBack!();
      },
      child: scaffold,
    );
  }

  Widget _conversation(BuildContext context) {
    if (loading && messages.isEmpty && pendingMessage == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (error != null && messages.isEmpty && pendingMessage == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off_outlined, size: 38),
              const SizedBox(height: 12),
              const Text("Unable to load this conversation",
                  style: TextStyle(fontWeight: FontWeight.w800)),
              const SizedBox(height: 6),
              Text(error!, textAlign: TextAlign.center),
              const SizedBox(height: 14),
              OutlinedButton.icon(
                onPressed: onRefresh,
                icon: const Icon(Icons.refresh),
                label: const Text("Retry"),
              ),
            ],
          ),
        ),
      );
    }
    if (messages.isEmpty && pendingMessage == null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.forum_outlined, size: 42),
              SizedBox(height: 14),
              Text("No conversations here yet",
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                  textAlign: TextAlign.center),
              SizedBox(height: 7),
              Text("Be the first to start a conversation in your neighborhood.",
                  textAlign: TextAlign.center),
            ],
          ),
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: NotificationListener<ScrollNotification>(
        onNotification: (notification) {
          if (notification.metrics.pixels >=
                  notification.metrics.maxScrollExtent - 120 &&
              hasOlderMessages &&
              !loadingOlderMessages) {
            onLoadOlder();
          }
          return false;
        },
        child: ListView.builder(
          reverse: true,
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 18),
          itemCount: messages.length +
              (pendingMessage != null ? 1 : 0) +
              (loadingOlderMessages ? 1 : 0),
          itemBuilder: (context, index) {
            if (pendingMessage != null && index == 0) {
              return RoomMessageBubble(
                body: pendingMessage!,
                author: "You",
                ownMessage: true,
                pending: sending,
                failed: sendError != null,
                mediaCount: attachmentCount,
              );
            }
            final offset = pendingMessage != null ? 1 : 0;
            if (loadingOlderMessages && index == messages.length + offset) {
              return const Padding(
                padding: EdgeInsets.all(16),
                child: Center(child: CircularProgressIndicator()),
              );
            }
            final post = messages[index - offset];
            return RoomMessageBubble(
              body: post.body,
              author: post.displayAuthor,
              ownMessage: post.authorId == currentUserId,
              time: post.createdAt,
              edited: post.editedAt != null,
              media: post.media,
              replyText: post.replyTo?.body,
              reactionCount: post.reactionCount,
              onLike: () => onLike(post),
              onTap: () => onOpenMessage(post),
              onLongPress: canSend ? () => onReply(post) : null,
            );
          },
        ),
      ),
    );
  }

  Widget _replyPreview(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(14, 8, 8, 0),
        child: Row(
          children: [
            Expanded(
              child: Text(
                "Replying to ${replyTo!.displayAuthor}: ${replyTo!.body}",
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style:
                    const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
              ),
            ),
            IconButton(
              tooltip: "Cancel reply",
              onPressed: onCancelReply,
              icon: const Icon(Icons.close, size: 18),
            ),
          ],
        ),
      );

  Widget _failedSend(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(14, 6, 8, 0),
        child: Row(
          children: [
            Expanded(
              child: Text(sendError!,
                  style: TextStyle(
                    color: EyeSemanticColors.of(context).errorText,
                    fontSize: 12,
                  )),
            ),
            TextButton.icon(
              onPressed: onSend,
              icon: const Icon(Icons.refresh, size: 18),
              label: const Text("Retry"),
            ),
          ],
        ),
      );

  Widget _composer(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(8, 7, 8, 9),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            SizedBox(
              width: 42,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    key: const Key("chat-expression-button"),
                    tooltip: "Emoji, GIF, and stickers",
                    constraints:
                        const BoxConstraints.tightFor(width: 40, height: 36),
                    padding: EdgeInsets.zero,
                    onPressed: canSend && !sending
                        ? () => _showExpressionPicker(context)
                        : null,
                    icon: const Icon(Icons.emoji_emotions_outlined, size: 22),
                  ),
                  IconButton(
                    key: const Key("chat-attachment-button"),
                    tooltip: "Add photo, video, or voice note",
                    constraints:
                        const BoxConstraints.tightFor(width: 40, height: 36),
                    padding: EdgeInsets.zero,
                    onPressed: canSend ? onToggleAttachments : null,
                    icon: Badge(
                      isLabelVisible: attachmentCount > 0,
                      label: Text("$attachmentCount"),
                      child: const Icon(Icons.add_circle_outline, size: 22),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: TextField(
                controller: messageController,
                enabled: canSend && !sending,
                minLines: 1,
                maxLines: 5,
                autocorrect: true,
                enableSuggestions: true,
                spellCheckConfiguration: WidgetsBinding.instance
                        .platformDispatcher.nativeSpellCheckServiceDefined
                    ? const SpellCheckConfiguration()
                    : const SpellCheckConfiguration.disabled(),
                contentInsertionConfiguration: ContentInsertionConfiguration(
                  allowedMimeTypes: const ["image/gif"],
                  onContentInserted: (content) {
                    unawaited(_insertKeyboardGif(context, content));
                  },
                ),
                keyboardType: TextInputType.multiline,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(
                  hintText: "Message your neighborhood...",
                  isDense: true,
                  border: OutlineInputBorder(),
                ),
                onSubmitted: (_) => onSend(),
              ),
            ),
            const SizedBox(width: 6),
            ValueListenableBuilder<TextEditingValue>(
              valueListenable: messageController,
              builder: (context, value, _) {
                final hasMessage = value.text.trim().isNotEmpty;
                final hasContent = hasMessage || attachmentCount > 0;
                if (!hasContent && !sending) {
                  return IconButton.filled(
                    tooltip: "Record voice message",
                    onPressed: canSend && evidenceController != null
                        ? () => _showVoiceRecorder(context)
                        : null,
                    icon: const Icon(Icons.mic_rounded),
                  );
                }
                return IconButton.filled(
                  tooltip: "Send message",
                  onPressed: canSend && !sending ? onSend : null,
                  icon: sending
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.send),
                );
              },
            ),
          ],
        ),
      );
}

class RoomMessageBubble extends StatelessWidget {
  const RoomMessageBubble({
    required this.body,
    required this.author,
    required this.ownMessage,
    this.time,
    this.edited = false,
    this.pending = false,
    this.failed = false,
    this.mediaCount = 0,
    this.media = const [],
    this.reactionCount = 0,
    this.replyText,
    this.onTap,
    this.onLongPress,
    this.onLike,
    super.key,
  });

  final String body;
  final String author;
  final bool ownMessage;
  final DateTime? time;
  final bool edited;
  final bool pending;
  final bool failed;
  final int mediaCount;
  final List<CommunityPostMediaReference> media;
  final int reactionCount;
  final String? replyText;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final VoidCallback? onLike;

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    final local = time?.toLocal();
    final timeLabel = local == null
        ? ""
        : "${local.hour.toString().padLeft(2, "0")}:${local.minute.toString().padLeft(2, "0")}";
    return Align(
      alignment: ownMessage ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 310),
        child: Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Material(
            color: ownMessage
                ? Theme.of(context).colorScheme.primaryContainer
                : semantics.elevatedSurface,
            borderRadius: BorderRadius.circular(8),
            child: InkWell(
              onTap: onTap,
              onLongPress: onLongPress,
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(11, 8, 11, 7),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(author,
                        style: const TextStyle(
                            fontSize: 12, fontWeight: FontWeight.w800)),
                    if (replyText != null && replyText!.trim().isNotEmpty) ...[
                      const SizedBox(height: 5),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(7),
                        decoration: BoxDecoration(
                          color: semantics.background.withValues(alpha: 0.55),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(replyText!,
                            maxLines: 2, overflow: TextOverflow.ellipsis),
                      ),
                    ],
                    if (body.trim().isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        body,
                        style: _chatStickers.any(
                          (sticker) => sticker.value == body.trim(),
                        )
                            ? const TextStyle(fontSize: 32, height: 1.15)
                            : null,
                      ),
                    ],
                    if (media.isNotEmpty) ...[
                      const SizedBox(height: 7),
                      _MediaPreview(media: media),
                    ] else if (mediaCount > 0) ...[
                      const SizedBox(height: 6),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.attach_file, size: 16),
                          Text(
                              "$mediaCount attachment${mediaCount == 1 ? "" : "s"}"),
                        ],
                      ),
                    ],
                    if (!pending && !failed)
                      InkWell(
                        onTap: onLike,
                        child: Padding(
                          padding: const EdgeInsets.only(top: 5, bottom: 2),
                          child: Text(
                            reactionCount > 0 ? "Like $reactionCount" : "Like",
                            style: TextStyle(
                              color: semantics.interactiveText,
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                    const SizedBox(height: 4),
                    Text(
                      [
                        if (timeLabel.isNotEmpty) timeLabel,
                        if (edited) "edited",
                        if (pending) "sending",
                        if (failed) "failed",
                        if (reactionCount > 0) "$reactionCount reactions",
                      ].join(" · "),
                      style: TextStyle(
                          fontSize: 10, color: semantics.secondaryText),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ChatExpressionSheet extends StatelessWidget {
  const _ChatExpressionSheet({
    required this.gifEnabled,
    required this.onEmoji,
    required this.onSticker,
    required this.onGif,
    required this.onGifAsset,
  });

  final bool gifEnabled;
  final ValueChanged<String> onEmoji;
  final ValueChanged<String> onSticker;
  final Future<void> Function() onGif;
  final Future<void> Function(
      ({String label, String asset, String fileName}) gif) onGifAsset;

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    return SafeArea(
      child: DefaultTabController(
        length: 3,
        child: SizedBox(
          height: 360,
          child: Column(
            children: [
              const TabBar(
                tabs: [
                  Tab(icon: Icon(Icons.emoji_emotions_outlined), text: "Emoji"),
                  Tab(icon: Icon(Icons.gif_box_outlined), text: "GIF"),
                  Tab(
                      icon: Icon(Icons.auto_awesome_outlined),
                      text: "Stickers"),
                ],
              ),
              Expanded(
                child: TabBarView(
                  children: [
                    GridView.builder(
                      padding: const EdgeInsets.all(12),
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 6,
                        mainAxisSpacing: 4,
                        crossAxisSpacing: 4,
                      ),
                      itemCount: _chatEmojis.length,
                      itemBuilder: (context, index) => IconButton(
                        tooltip: "Insert ${_chatEmojis[index]}",
                        onPressed: () => onEmoji(_chatEmojis[index]),
                        icon: Text(
                          _chatEmojis[index],
                          style: const TextStyle(fontSize: 26),
                        ),
                      ),
                    ),
                    Column(
                      children: [
                        Expanded(
                          child: GridView.builder(
                            padding: const EdgeInsets.all(12),
                            gridDelegate:
                                const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: 2,
                              childAspectRatio: 1.35,
                              mainAxisSpacing: 8,
                              crossAxisSpacing: 8,
                            ),
                            itemCount: _chatGifs.length,
                            itemBuilder: (context, index) {
                              final gif = _chatGifs[index];
                              return Material(
                                color: semantics.elevatedSurface,
                                borderRadius: BorderRadius.circular(8),
                                clipBehavior: Clip.antiAlias,
                                child: InkWell(
                                  onTap:
                                      gifEnabled ? () => onGifAsset(gif) : null,
                                  child: Stack(
                                    fit: StackFit.expand,
                                    children: [
                                      Image.asset(gif.asset,
                                          fit: BoxFit.contain),
                                      Align(
                                        alignment: Alignment.bottomCenter,
                                        child: ColoredBox(
                                          color: Colors.black54,
                                          child: SizedBox(
                                            width: double.infinity,
                                            child: Padding(
                                              padding: const EdgeInsets.all(4),
                                              child: Text(
                                                gif.label,
                                                textAlign: TextAlign.center,
                                                style: TextStyle(
                                                  color: semantics
                                                      .textOnDarkSurface,
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.w700,
                                                ),
                                              ),
                                            ),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(12, 4, 12, 10),
                          child: SizedBox(
                            width: double.infinity,
                            child: OutlinedButton.icon(
                              onPressed: gifEnabled ? onGif : null,
                              icon: const Icon(Icons.folder_open),
                              label: const Text("Choose GIF from device"),
                            ),
                          ),
                        ),
                      ],
                    ),
                    GridView.builder(
                      padding: const EdgeInsets.all(12),
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        childAspectRatio: 1.55,
                        mainAxisSpacing: 8,
                        crossAxisSpacing: 8,
                      ),
                      itemCount: _chatStickers.length,
                      itemBuilder: (context, index) {
                        final sticker = _chatStickers[index];
                        return Material(
                          color: semantics.elevatedSurface,
                          borderRadius: BorderRadius.circular(8),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(8),
                            onTap: () => onSticker(sticker.value),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(sticker.value,
                                    style: const TextStyle(fontSize: 30)),
                                const SizedBox(height: 5),
                                Text(sticker.label,
                                    style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700)),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MediaPreview extends StatelessWidget {
  const _MediaPreview({required this.media});

  final List<CommunityPostMediaReference> media;

  @override
  Widget build(BuildContext context) {
    final first = media.first;
    final url = first.signedGetUrl;
    if (first.isImage && url != null && url.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(6),
        child: Image.network(
          url,
          width: 230,
          height: 145,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) =>
              _fallback(Icons.image_not_supported_outlined),
        ),
      );
    }
    return _fallback(
      first.isVideo ? Icons.play_circle_outline : Icons.graphic_eq,
      label: first.isVideo ? "Video" : "Voice note",
    );
  }

  Widget _fallback(IconData icon, {String? label}) => Container(
        width: 230,
        height: 72,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: Colors.black12,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon),
            if (label != null) ...[
              const SizedBox(width: 7),
              Text(label),
            ],
          ],
        ),
      );
}
