import "dart:async";

import "package:flutter/material.dart";
import "package:uuid/uuid.dart";

import "../voice/voice_recorder.dart";
import "../widgets/eye_scaffold.dart";
import "pending_support_message_store.dart";
import "support_models.dart";
import "support_service.dart";

class SupportNewChatScreen extends StatefulWidget {
  const SupportNewChatScreen({
    required this.accessToken,
    this.prefill = const SupportNewChatPrefill(),
    super.key,
  });

  final String accessToken;
  final SupportNewChatPrefill prefill;

  @override
  State<SupportNewChatScreen> createState() => _SupportNewChatScreenState();
}

class _SupportNewChatScreenState extends State<SupportNewChatScreen> {
  final _service = SupportService();
  final _subjectController = TextEditingController();
  final _bodyController = TextEditingController();
  SupportCategory _category = SupportCategory.other;
  String? _incidentId;
  bool _submitting = false;
  String? _voiceAttachmentKey;
  List<Map<String, String>> _incidents = [];

  @override
  void initState() {
    super.initState();
    _category = widget.prefill.category;
    _incidentId = widget.prefill.incidentId;
    if (widget.prefill.subject != null) {
      _subjectController.text = widget.prefill.subject!;
    }
    _loadIncidents();
  }

  Future<void> _loadIncidents() async {
    try {
      final incidents =
          await _service.listRecentIncidents(accessToken: widget.accessToken);
      if (!mounted) return;
      setState(() => _incidents = incidents);
    } catch (_) {}
  }

  Future<void> _submit() async {
    final subject = _subjectController.text.trim();
    final body = _bodyController.text.trim();
    if (subject.isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text("Subject is required")));
      return;
    }
    if (body.isEmpty && _voiceAttachmentKey == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Add a message or voice recording")),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      final clientMessageId = const Uuid().v4();
      final conversation = await _service.createConversation(
        accessToken: widget.accessToken,
        category: _category,
        subject: subject,
        body: body.isEmpty ? null : body,
        incidentId: _incidentId,
        clientMessageId: clientMessageId,
        attachmentKey: _voiceAttachmentKey,
        messageType: _voiceAttachmentKey != null ? "Voice" : "Text",
        diagnosticMetadata: widget.prefill.diagnosticMetadata,
      );
      if (!mounted) return;
      Navigator.of(context).pushReplacementNamed(
        "/support/conversation",
        arguments: SupportConversationRouteArgs(conversationId: conversation.id),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Unable to start support chat")),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return EyeScaffold(
      title: "New support chat",
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          DropdownButtonFormField<SupportCategory>(
            initialValue: _category,
            decoration: const InputDecoration(labelText: "Issue category"),
            items: SupportCategory.values
                .map((category) => DropdownMenuItem(
                      value: category,
                      child: Text(category.label),
                    ))
                .toList(),
            onChanged: (value) {
              if (value != null) setState(() => _category = value);
            },
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _subjectController,
            decoration: const InputDecoration(labelText: "Subject"),
          ),
          const SizedBox(height: 12),
          if (_incidents.isNotEmpty)
            DropdownButtonFormField<String?>(
              initialValue: _incidentId,
              decoration: const InputDecoration(labelText: "Related incident (optional)"),
              items: [
                const DropdownMenuItem(value: null, child: Text("None")),
                ..._incidents.map(
                  (incident) => DropdownMenuItem(
                    value: incident["id"],
                    child: Text(incident["title"] ?? "Incident"),
                  ),
                ),
              ],
              onChanged: (value) => setState(() => _incidentId = value),
            ),
          const SizedBox(height: 12),
          TextField(
            controller: _bodyController,
            minLines: 3,
            maxLines: 6,
            decoration: const InputDecoration(
              labelText: "Describe your issue (optional if voice attached)",
            ),
          ),
          const SizedBox(height: 16),
          VoiceRecorder(
            onRecordingReady: (result) {
              setState(() {
                _voiceAttachmentKey = "pending";
                if (_bodyController.text.trim().isEmpty) {
                  _bodyController.text = "[Voice message attached]";
                }
              });
            },
          ),
          const SizedBox(height: 24),
          FilledButton(
            onPressed: _submitting ? null : _submit,
            child: _submitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text("Start chat"),
          ),
        ],
      ),
    );
  }
}

class SupportConversationScreen extends StatefulWidget {
  const SupportConversationScreen({
    required this.accessToken,
    required this.conversationId,
    this.isOnline = true,
    super.key,
  });

  final String accessToken;
  final String conversationId;
  final bool isOnline;

  @override
  State<SupportConversationScreen> createState() =>
      _SupportConversationScreenState();
}

class _SupportConversationScreenState extends State<SupportConversationScreen> {
  final _service = SupportService();
  final _composer = TextEditingController();
  SupportConversationDetail? _conversation;
  Timer? _pollTimer;
  bool _loading = true;
  bool _sending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _refresh();
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) => _refresh(silent: true));
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _composer.dispose();
    super.dispose();
  }

  Future<void> _refresh({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final conversation = await _service.getConversation(
        accessToken: widget.accessToken,
        conversationId: widget.conversationId,
      );
      await _service.markRead(
        accessToken: widget.accessToken,
        conversationId: widget.conversationId,
      );
      if (!mounted) return;
      setState(() {
        _conversation = conversation;
        _loading = false;
      });
    } catch (_) {
      if (!mounted || silent) return;
      setState(() {
        _error = "Unable to load conversation.";
        _loading = false;
      });
    }
  }

  Future<void> _send() async {
    final body = _composer.text.trim();
    if (body.isEmpty) return;
    if (!widget.isOnline) {
      final store = await PendingSupportMessageStore.create();
      final pending = await store.load();
      pending.add(
        PendingSupportMessage(
          conversationId: widget.conversationId,
          clientMessageId: const Uuid().v4(),
          body: body,
        ),
      );
      await store.save(pending);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Message saved offline and will retry")),
      );
      _composer.clear();
      return;
    }
    setState(() => _sending = true);
    try {
      await _service.sendMessage(
        accessToken: widget.accessToken,
        conversationId: widget.conversationId,
        body: body,
        clientMessageId: const Uuid().v4(),
      );
      _composer.clear();
      await _refresh(silent: true);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Failed to send message")),
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return EyeScaffold(
      title: _conversation?.subject ?? "Support chat",
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!))
              : Column(
                  children: [
                    if (!widget.isOnline)
                      MaterialBanner(
                        content: const Text("Offline — messages will retry when connected"),
                        actions: [
                          TextButton(onPressed: () {}, child: const Text("OK")),
                        ],
                      ),
                    Expanded(
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _conversation?.messages.length ?? 0,
                        itemBuilder: (context, index) {
                          final message = _conversation!.messages[index];
                          final isAdmin = message.senderRole == "Admin";
                          return Align(
                            alignment:
                                isAdmin ? Alignment.centerLeft : Alignment.centerRight,
                            child: Container(
                              margin: const EdgeInsets.only(bottom: 8),
                              padding: const EdgeInsets.all(12),
                              constraints: const BoxConstraints(maxWidth: 320),
                              decoration: BoxDecoration(
                                color: isAdmin
                                    ? Theme.of(context).colorScheme.surfaceContainerHighest
                                    : Theme.of(context).colorScheme.primaryContainer,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    message.senderName,
                                    semanticsLabel: "Sender ${message.senderName}",
                                    style: const TextStyle(fontWeight: FontWeight.w700),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(message.body),
                                  const SizedBox(height: 4),
                                  Text(
                                    message.createdAt,
                                    style: Theme.of(context).textTheme.labelSmall,
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                    SafeArea(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: _composer,
                                minLines: 1,
                                maxLines: 4,
                                decoration: const InputDecoration(
                                  hintText: "Type a message",
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Semantics(
                              button: true,
                              label: "Send support message",
                              child: IconButton(
                                onPressed: _sending ? null : _send,
                                icon: const Icon(Icons.send),
                              ),
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
