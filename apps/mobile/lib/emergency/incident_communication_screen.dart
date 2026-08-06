import "dart:async";

import "package:flutter/material.dart";
import "package:flutter/semantics.dart";
import "package:uuid/uuid.dart";

import "../contracts/the_eye_api_client.dart";
import "../design_system/components/eye_page_back_header.dart";
import "incident_communication_contract.dart";
import "incident_communication_service.dart";

class IncidentCommunicationScreen extends StatefulWidget {
  const IncidentCommunicationScreen({
    super.key,
    required this.incidentId,
    required this.accessToken,
    required this.apiClient,
    this.readOnly = false,
  });

  final String incidentId;
  final String accessToken;
  final TheEyeApiClient apiClient;
  final bool readOnly;

  @override
  State<IncidentCommunicationScreen> createState() => _IncidentCommunicationScreenState();
}

class _IncidentCommunicationScreenState extends State<IncidentCommunicationScreen> {
  late final IncidentCommunicationService _service;
  final _composerController = TextEditingController();
  final _scrollController = ScrollController();
  List<IncidentThreadMessage> _messages = const [];
  IncidentCommunicationAllowedActions _actions = IncidentCommunicationAllowedActions.empty();
  bool _loading = true;
  String? _error;
  bool _sending = false;
  Timer? _pollTimer;
  String _conversationStatus = "Active";

  @override
  void initState() {
    super.initState();
    _service = IncidentCommunicationService(widget.apiClient);
    unawaited(_refresh(initial: true));
    _pollTimer = Timer.periodic(const Duration(seconds: 10), (_) => unawaited(_refresh()));
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _composerController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _refresh({bool initial = false}) async {
    if (!mounted) return;
    if (initial) setState(() => _loading = true);
    try {
      await _service.flushQueue(widget.incidentId, widget.accessToken);
      final conversation = await _service.fetchConversation(widget.incidentId, widget.accessToken);
      final messages = await _service.fetchMessages(widget.incidentId, widget.accessToken);
      if (!mounted) return;
      setState(() {
        _messages = messages.reversed.toList(growable: false);
        _conversationStatus = conversation["conversationStatus"]?.toString() ?? "Active";
        _actions = IncidentCommunicationAllowedActions.fromJson(
          (conversation["allowedCommunicationActions"] as Map<String, dynamic>?) ?? const {},
        );
        _error = null;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = "Unable to load communication thread.";
        _loading = false;
      });
    }
  }

  Future<void> _sendText() async {
    final body = _composerController.text.trim();
    if (body.isEmpty || !_actions.sendText || widget.readOnly) return;
    setState(() => _sending = true);
    final clientMessageId = const Uuid().v4();
    try {
      await _service.sendMessage(
        incidentId: widget.incidentId,
        accessToken: widget.accessToken,
        clientMessageId: clientMessageId,
        messageType: "Text",
        body: body,
      );
      _composerController.clear();
      await _refresh();
    } catch (_) {
      await _service.enqueueOffline(
        QueuedIncidentMessage(
          clientMessageId: clientMessageId,
          incidentId: widget.incidentId,
          messageType: "Text",
          body: body,
          createdAt: DateTime.now().toUtc(),
        ),
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Message queued offline and will retry automatically.")),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _sendQuickReply(String action) async {
    if (!_actions.quickReply || widget.readOnly) return;
    final clientMessageId = const Uuid().v4();
    await _service.sendMessage(
      incidentId: widget.incidentId,
      accessToken: widget.accessToken,
      clientMessageId: clientMessageId,
      messageType: "QuickReply",
      structuredAction: {"action": action},
    );
    await _refresh();
  }

  @override
  Widget build(BuildContext context) {
    final readOnly = widget.readOnly ||
        _conversationStatus == "Closed" ||
        _conversationStatus == "Archived" ||
        !_actions.openThread;
    return Scaffold(
      appBar: AppBar(
        title: Semantics(
          header: true,
          label: "Emergency communication",
          child: const Text("Communication"),
        ),
      ),
      body: Column(
        children: [
          EyePageBackHeader(label: "Back to active emergency"),
          if (readOnly)
            Semantics(
              liveRegion: true,
              label: "This incident has been resolved. The communication record is now read-only.",
              child: Material(
                color: Theme.of(context).colorScheme.secondaryContainer,
                child: const Padding(
                  padding: EdgeInsets.all(12),
                  child: Text(
                    "This incident has been resolved. The communication record is now read-only.",
                  ),
                ),
              ),
            ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(child: Text(_error!))
                    : ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.all(16),
                        itemCount: _messages.length,
                        itemBuilder: (context, index) {
                          final message = _messages[index];
                          final isOfficial = message.senderRole != "Reporter";
                          return Semantics(
                            label:
                                "${message.senderLabel}, ${message.messageType}, ${message.createdAt.toLocal()}",
                            child: Align(
                              alignment:
                                  isOfficial ? Alignment.centerLeft : Alignment.centerRight,
                              child: Container(
                                margin: const EdgeInsets.only(bottom: 12),
                                padding: const EdgeInsets.all(12),
                                constraints: const BoxConstraints(maxWidth: 320),
                                decoration: BoxDecoration(
                                  color: isOfficial
                                      ? Theme.of(context).colorScheme.surfaceContainerHighest
                                      : Theme.of(context).colorScheme.primaryContainer,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      message.senderLabel,
                                      style: Theme.of(context).textTheme.labelLarge,
                                    ),
                                    const SizedBox(height: 4),
                                    Text(message.body),
                                    const SizedBox(height: 4),
                                    Text(
                                      message.deliveryState ?? "Sent",
                                      style: Theme.of(context).textTheme.bodySmall,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
          ),
          if (!readOnly)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                children: [
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final action in const [
                        "yes",
                        "no",
                        "unsure",
                        "still_ongoing",
                        "situation_resolved",
                        "unsafe_to_respond",
                      ])
                        Semantics(
                          button: true,
                          label: "Quick reply $action",
                          child: OutlinedButton(
                            onPressed: _sending ? null : () => _sendQuickReply(action),
                            child: Text(action.replaceAll("_", " ")),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: Semantics(
                          textField: true,
                          label: "Type a message to dispatch",
                          child: TextField(
                            controller: _composerController,
                            minLines: 1,
                            maxLines: 4,
                            decoration: const InputDecoration(
                              hintText: "Message dispatch or responders",
                              border: OutlineInputBorder(),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Semantics(
                        button: true,
                        label: "Send message",
                        child: FilledButton(
                          onPressed: _sending || !_actions.sendText ? null : _sendText,
                          child: _sending
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Icon(Icons.send),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
