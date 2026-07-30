import "package:flutter/material.dart";

import "../design_system/eye_semantic_colors.dart";
import "../contracts/the_eye_api_client.dart";
import "../evidence/local_evidence_attachment.dart";
import "../voice/voice_recorder.dart";
import "../widgets/eye_scaffold.dart";
import "community_members_screen.dart";
import "community_media_upload_service.dart";
import "community_post_validation.dart";
import "neighborhood_watch_service.dart";

class CommunityPostDetailRouteArgs {
  const CommunityPostDetailRouteArgs({
    required this.postId,
    required this.postTitle,
    required this.communityId,
    this.currentUserId,
  });

  final String postId;
  final String postTitle;
  final String communityId;
  final String? currentUserId;
}

class CommunityPostDetailScreen extends StatefulWidget {
  const CommunityPostDetailScreen({
    required this.accessToken,
    required this.args,
    this.isOnline = true,
    super.key,
  });

  final String accessToken;
  final CommunityPostDetailRouteArgs args;
  final bool isOnline;

  @override
  State<CommunityPostDetailScreen> createState() =>
      _CommunityPostDetailScreenState();
}

class _CommunityPostDetailScreenState extends State<CommunityPostDetailScreen> {
  final NeighborhoodWatchService _service = NeighborhoodWatchService();
  final CommunityMediaUploadService _mediaUploadService =
      CommunityMediaUploadService();
  final _commentController = TextEditingController();
  final List<CommunityCommentItem> _comments = [];
  LocalEvidenceAttachment? _pendingVoiceAttachment;
  String? _replyToCommentId;
  String? _nextCursor;
  String? _error;
  bool _loading = false;
  bool _loadingMore = false;
  bool _posting = false;

  @override
  void initState() {
    super.initState();
    _load(refresh: true);
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _load({bool refresh = false}) async {
    if (_loading || _loadingMore) return;
    if (refresh) {
      setState(() {
        _loading = true;
        _error = null;
        _nextCursor = null;
      });
    } else {
      if (_nextCursor == null) return;
      setState(() => _loadingMore = true);
    }
    try {
      final page = await _service.listComments(
        accessToken: widget.accessToken,
        postId: widget.args.postId,
        cursor: refresh ? null : _nextCursor,
      );
      if (!mounted) return;
      setState(() {
        if (refresh) _comments.clear();
        _comments.addAll(page.items);
        _nextCursor = page.nextCursor;
        _error = null;
      });
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.userMessage);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = "Unable to load comments.");
    } finally {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _loadingMore = false;
      });
    }
  }

  Future<void> _addComment() async {
    final body = _commentController.text.trim();
    final attachments =
        _pendingVoiceAttachment == null ? const <LocalEvidenceAttachment>[] : [_pendingVoiceAttachment!];
    if (!hasValidCommunityCommentNarrative(body: body, attachments: attachments)) {
      setState(() => _error = "Add text or record a voice comment.");
      return;
    }
    if (!widget.isOnline) {
      setState(() =>
          _error = "You are offline. Comment will stay in the draft field.");
      return;
    }
    final optimisticId = "pending-${DateTime.now().millisecondsSinceEpoch}";
    final optimistic = CommunityCommentItem(
      id: optimisticId,
      body: body.isNotEmpty ? body : voiceCommentPreview(),
      authorId: widget.args.currentUserId ?? "",
      authorName: "You",
      createdAt: DateTime.now(),
      pending: true,
      parentCommentId: _replyToCommentId,
      media: attachments.isNotEmpty
          ? [
              CommunityCommentMediaItem(
                id: attachments.first.localId,
                mediaType: attachments.first.mediaType,
                contentType: attachments.first.contentType,
                durationSeconds: attachments.first.durationSeconds,
              ),
            ]
          : const [],
    );
    setState(() {
      _comments.add(optimistic);
      _commentController.clear();
      _pendingVoiceAttachment = null;
      _posting = true;
      _error = null;
    });
    try {
      var media = const <CommunityPostMediaItem>[];
      if (attachments.isNotEmpty) {
        media = await _mediaUploadService.uploadForPost(
          communityId: widget.args.communityId,
          attachments: attachments,
          accessToken: widget.accessToken,
        );
      }
      final saved = await _service.createComment(
        accessToken: widget.accessToken,
        postId: widget.args.postId,
        body: body.isEmpty ? null : body,
        parentCommentId: _replyToCommentId,
        media: media,
      );
      if (!mounted) return;
      setState(() {
        final index = _comments.indexWhere((item) => item.id == optimisticId);
        if (index >= 0) {
          _comments[index] = saved.copyWith(
            authorId: widget.args.currentUserId ?? saved.authorId,
            authorName: "You",
          );
        }
        _replyToCommentId = null;
      });
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      setState(() {
        final index = _comments.indexWhere((item) => item.id == optimisticId);
        if (index >= 0) {
          _comments[index] = _comments[index].copyWith(failed: true);
        }
        _error = error.userMessage;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        final index = _comments.indexWhere((item) => item.id == optimisticId);
        if (index >= 0) {
          _comments[index] = _comments[index].copyWith(failed: true);
        }
        _error = "Unable to post comment.";
      });
    } finally {
      if (mounted) setState(() => _posting = false);
    }
  }

  Future<void> _editComment(CommunityCommentItem comment) async {
    if (comment.hasVoice) return;
    final controller = TextEditingController(text: comment.body);
    final updated = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Edit comment"),
        content: TextField(controller: controller, maxLines: 4),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text("Cancel")),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: const Text("Save"),
          ),
        ],
      ),
    );
    controller.dispose();
    if (updated == null || updated.isEmpty) return;
    try {
      final saved = await _service.updateComment(
        accessToken: widget.accessToken,
        postId: widget.args.postId,
        commentId: comment.id,
        body: updated,
      );
      if (!mounted) return;
      setState(() {
        final index = _comments.indexWhere((item) => item.id == comment.id);
        if (index >= 0) {
          _comments[index] = saved.copyWith(
            authorId: comment.authorId,
            authorName: comment.authorName,
          );
        }
      });
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(error.userMessage)));
    }
  }

  Future<void> _deleteComment(CommunityCommentItem comment) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Delete comment"),
        content: const Text("Remove this comment?"),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text("Cancel")),
          FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text("Delete")),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await _service.deleteComment(
        accessToken: widget.accessToken,
        postId: widget.args.postId,
        commentId: comment.id,
      );
      if (!mounted) return;
      setState(() => _comments.removeWhere((item) => item.id == comment.id));
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(error.userMessage)));
    }
  }

  bool _isOwnComment(CommunityCommentItem comment) {
    final userId = widget.args.currentUserId;
    return userId != null && userId.isNotEmpty && comment.authorId == userId;
  }

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    return EyeScaffold(
      title: widget.args.postTitle,
      actions: [
        IconButton(
          icon: const Icon(Icons.flag_outlined),
          onPressed: () {
            Navigator.of(context).pushNamed(
              "/neighborhood-watch/report",
              arguments: CommunityReportRouteArgs(
                communityId: widget.args.communityId,
                targetType: "Post",
                targetId: widget.args.postId,
                targetLabel: widget.args.postTitle,
              ),
            );
          },
        ),
      ],
      body: Column(
        children: [
          if (!widget.isOnline)
            MaterialBanner(
              content: const Text(
                  "Offline — comments will not send until you reconnect."),
              actions: [TextButton(onPressed: () {}, child: const Text("OK"))],
            ),
          if (_replyToCommentId != null)
            MaterialBanner(
              content: const Text("Replying to a comment"),
              actions: [
                TextButton(
                  onPressed: () => setState(() => _replyToCommentId = null),
                  child: const Text("Cancel reply"),
                ),
              ],
            ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => _load(refresh: true),
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  if (_loading && _comments.isEmpty)
                    const Center(child: CircularProgressIndicator())
                  else if (_error != null && _comments.isEmpty)
                    ListTile(
                      leading: const Icon(Icons.cloud_off),
                      title: const Text("Comments unavailable"),
                      subtitle: Text(_error!),
                    )
                  else if (_comments.isEmpty)
                    const ListTile(
                      leading: Icon(Icons.chat_bubble_outline),
                      title: Text("No comments yet"),
                    )
                  else
                    ..._comments.map((comment) {
                      final own = _isOwnComment(comment);
                      final isReply = comment.parentCommentId != null;
                      return Card(
                        margin: EdgeInsets.only(left: isReply ? 24 : 0),
                        child: ListTile(
                          title: Text(comment.authorName),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (comment.body.isNotEmpty) Text(comment.body),
                              if (comment.hasVoice)
                                Text(
                                  comment.media
                                          .firstWhere((item) => item.mediaType == "Audio")
                                          .transcript ??
                                      "Voice comment attached",
                                  style: const TextStyle(fontStyle: FontStyle.italic),
                                ),
                              if (comment.pending)
                                const Text("Sending…",
                                    style: TextStyle(fontSize: 12)),
                              if (comment.failed)
                                TextButton(
                                  onPressed: () {
                                    _commentController.text = comment.body;
                                    setState(() => _comments.removeWhere(
                                        (item) => item.id == comment.id));
                                  },
                                  child: const Text("Retry"),
                                ),
                            ],
                          ),
                          trailing: PopupMenuButton<String>(
                            onSelected: (value) {
                              if (value == "reply") {
                                setState(() => _replyToCommentId = comment.id);
                              } else if (value == "edit" && own) {
                                _editComment(comment);
                              } else if (value == "delete" && own) {
                                _deleteComment(comment);
                              } else if (value == "report") {
                                Navigator.of(context).pushNamed(
                                  "/neighborhood-watch/report",
                                  arguments: CommunityReportRouteArgs(
                                    communityId: widget.args.communityId,
                                    targetType: "Comment",
                                    targetId: comment.id,
                                    targetLabel: comment.body,
                                  ),
                                );
                              }
                            },
                            itemBuilder: (context) => [
                              const PopupMenuItem(
                                  value: "reply", child: Text("Reply")),
                              if (own && !comment.hasVoice)
                                const PopupMenuItem(
                                    value: "edit", child: Text("Edit")),
                              if (own)
                                const PopupMenuItem(
                                    value: "delete", child: Text("Delete")),
                              const PopupMenuItem(
                                  value: "report", child: Text("Report")),
                            ],
                          ),
                        ),
                      );
                    }),
                  if (_nextCursor != null)
                    Center(
                      child: _loadingMore
                          ? const CircularProgressIndicator()
                          : OutlinedButton(
                              onPressed: () => _load(refresh: false),
                              child: const Text("Load more comments"),
                            ),
                    ),
                ],
              ),
            ),
          ),
          SafeArea(
            child: Container(
              color: semantics.surface,
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  VoiceRecorder(
                    enabled: !_posting,
                    onRecordingReady: (result) => setState(
                        () => _pendingVoiceAttachment = result.attachment),
                    onRecordingRemoved: () =>
                        setState(() => _pendingVoiceAttachment = null),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _commentController,
                          decoration: const InputDecoration(
                            hintText: "Add a comment (optional with voice)",
                          ),
                          maxLines: 3,
                          minLines: 1,
                        ),
                      ),
                      const SizedBox(width: 8),
                      IconButton(
                        onPressed: _posting ? null : _addComment,
                        icon: _posting
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Icon(Icons.send),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
