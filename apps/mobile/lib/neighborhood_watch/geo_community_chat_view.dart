import "package:flutter/material.dart";

import "../design_system/eye_semantic_colors.dart";
import "../evidence/evidence_attachment_picker.dart";
import "../evidence/evidence_capture_controller.dart";
import "neighborhood_watch_prototype_chrome.dart";
import "neighborhood_watch_service.dart";

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
  final List<Widget> headerActions;
  final Widget? locationNotice;
  final String? currentUserId;
  final String? error;
  final String? pendingMessage;
  final String? sendError;
  final CommunityPostItem? replyTo;

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    return NwPrototypeScaffold(
      title: title,
      subtitle: subtitle,
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
            IconButton(
              tooltip: "Add photo, video, or voice note",
              onPressed: canSend ? onToggleAttachments : null,
              icon: Badge(
                isLabelVisible: attachmentCount > 0,
                label: Text("$attachmentCount"),
                child: const Icon(Icons.add_circle_outline),
              ),
            ),
            Expanded(
              child: TextField(
                controller: messageController,
                enabled: canSend && !sending,
                minLines: 1,
                maxLines: 5,
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
            IconButton.filled(
              tooltip: "Send message",
              onPressed: canSend && !sending ? onSend : null,
              icon: sending
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.send),
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
                      Text(body),
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
