import "dart:async";

import "package:flutter/material.dart";
import "package:geolocator/geolocator.dart";
import "package:uuid/uuid.dart";

import "../contracts/the_eye_api_client.dart";
import "../design_system/components/eye_page_header.dart";
import "../evidence/evidence_attachment_picker.dart";
import "../evidence/evidence_upload_service.dart";
import "../evidence/local_evidence_attachment.dart";
import "../presentation/citizen_date_time.dart";
import "../voice/voice_recorder.dart";
import "../voice/voice_report_validation.dart";
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
  State<IncidentCommunicationScreen> createState() =>
      _IncidentCommunicationScreenState();
}

class _IncidentCommunicationScreenState
    extends State<IncidentCommunicationScreen> {
  late final IncidentCommunicationService _service;
  final _composerController = TextEditingController();
  final _scrollController = ScrollController();
  List<IncidentThreadMessage> _messages = const [];
  IncidentCommunicationAllowedActions _actions =
      IncidentCommunicationAllowedActions.empty();
  bool _loading = true;
  String? _error;
  bool _sending = false;
  String? _pendingInformationRequestId;
  String? _pendingInformationRequestPrompt;
  Timer? _pollTimer;
  String _conversationStatus = "Active";
  late final EvidenceUploadService _uploadService;

  @override
  void initState() {
    super.initState();
    _service = IncidentCommunicationService(widget.apiClient);
    _uploadService = EvidenceUploadService(apiClient: widget.apiClient);
    unawaited(_refresh(initial: true));
    _pollTimer = Timer.periodic(
        const Duration(seconds: 10), (_) => unawaited(_refresh()));
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
      await _service.flushQueue(
        widget.incidentId,
        widget.accessToken,
        uploadService: _uploadService,
      );
      final conversation = await _service.fetchConversation(
          widget.incidentId, widget.accessToken);
      final messages =
          await _service.fetchMessages(widget.incidentId, widget.accessToken);
      if (!mounted) return;
      setState(() {
        _messages = messages.reversed.toList(growable: false);
        _pendingInformationRequestId = _extractPendingRequestId(_messages);
        _pendingInformationRequestPrompt =
            _extractPendingRequestPrompt(_messages);
        _conversationStatus =
            conversation["conversationStatus"]?.toString() ?? "Active";
        _actions = IncidentCommunicationAllowedActions.fromJson(
          (conversation["allowedCommunicationActions"]
                  as Map<String, dynamic>?) ??
              const {},
        );
        _error = null;
        _loading = false;
      });
      await _markOfficialMessagesRead(_messages);
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
          const SnackBar(
              content:
                  Text("Message queued offline and will retry automatically.")),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  String? _extractPendingRequestId(List<IncidentThreadMessage> messages) {
    for (final message in messages.reversed) {
      if (message.messageType != "InformationRequest") continue;
      final requestId = message.structuredAction?["requestId"]?.toString();
      if (requestId != null && requestId.isNotEmpty) return requestId;
    }
    return null;
  }

  String? _extractPendingRequestPrompt(List<IncidentThreadMessage> messages) {
    for (final message in messages.reversed) {
      if (message.messageType != "InformationRequest") continue;
      final requestId = message.structuredAction?["requestId"]?.toString();
      if (requestId != null && requestId.isNotEmpty) return message.body;
    }
    return null;
  }

  Future<void> _sendMediaMessage(
      String messageType, LocalEvidenceAttachment attachment) async {
    if (widget.readOnly) return;
    setState(() => _sending = true);
    final clientMessageId = const Uuid().v4();
    try {
      final uploaded = await _uploadService.uploadForIncident(
        incidentId: widget.incidentId,
        attachments: [attachment],
        accessToken: widget.accessToken,
        fallbackLatitude: attachment.latitude,
        fallbackLongitude: attachment.longitude,
      );
      final mediaId = uploaded.first.id;
      if (mediaId == null || mediaId.isEmpty) {
        throw StateError("Uploaded media did not return an id");
      }
      await _service.sendMessage(
        incidentId: widget.incidentId,
        accessToken: widget.accessToken,
        clientMessageId: clientMessageId,
        messageType: messageType,
        attachmentId: mediaId,
        structuredAction: _pendingInformationRequestId == null
            ? null
            : {"requestId": _pendingInformationRequestId},
      );
      await _refresh();
    } catch (_) {
      await _service.enqueueOffline(
        QueuedIncidentMessage(
          clientMessageId: clientMessageId,
          incidentId: widget.incidentId,
          messageType: messageType,
          body: messageType,
          createdAt: DateTime.now().toUtc(),
          attachmentLocalPath: attachment.uploadPath,
          localAttachment: attachment.toJson(),
          structuredAction: _pendingInformationRequestId == null
              ? null
              : {"requestId": _pendingInformationRequestId},
        ),
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content:
                  Text("Media queued offline and will retry automatically.")),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _pickPhoto() async {
    if (!_actions.sendPhoto || widget.readOnly) return;
    final controller = createEvidenceCaptureController(context);
    await controller.pickImage();
    final attachment =
        controller.attachments.isNotEmpty ? controller.attachments.last : null;
    controller.dispose();
    if (attachment == null) return;
    await _sendMediaMessage("Image", attachment);
  }

  Future<void> _recordVoice() async {
    if (!_actions.sendVoice || widget.readOnly) return;
    final recording = await showModalBottomSheet<VoiceRecordingResult>(
      context: context,
      isScrollControlled: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: VoiceRecorder(
            onRecordingReady: (result) => Navigator.of(context).pop(result),
          ),
        ),
      ),
    );
    if (recording == null) return;
    await _sendMediaMessage("Voice", recording.attachment);
  }

  Future<void> _sendLocationUpdate() async {
    if (!_actions.sendLocation || widget.readOnly) return;
    setState(() => _sending = true);
    final clientMessageId = const Uuid().v4();
    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings:
            const LocationSettings(accuracy: LocationAccuracy.high),
      );
      await _service.sendMessage(
        incidentId: widget.incidentId,
        accessToken: widget.accessToken,
        clientMessageId: clientMessageId,
        messageType: "LocationUpdate",
        structuredAction: {
          "latitude": position.latitude,
          "longitude": position.longitude,
          "accuracyMeters": position.accuracy,
          if (_pendingInformationRequestId != null)
            "requestId": _pendingInformationRequestId,
        },
      );
      await _refresh();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text("Unable to share location. Please try again.")),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _markOfficialMessagesRead(
      List<IncidentThreadMessage> messages) async {
    for (final message in messages) {
      if (message.senderRole == "Reporter") continue;
      if (message.deliveryState == "Read") continue;
      try {
        await _service.markRead(
            widget.incidentId, message.id, widget.accessToken);
      } catch (_) {
        // Non-fatal; unread badge may lag until next refresh.
      }
    }
  }

  Future<void> _sendQuickReply(String action) async {
    if (!_actions.quickReply || widget.readOnly) return;
    setState(() => _sending = true);
    final clientMessageId = const Uuid().v4();
    try {
      await _service.sendMessage(
        incidentId: widget.incidentId,
        accessToken: widget.accessToken,
        clientMessageId: clientMessageId,
        messageType: "QuickReply",
        structuredAction: {
          "action": action,
          if (_pendingInformationRequestId != null)
            "requestId": _pendingInformationRequestId,
        },
      );
      await _refresh();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text("Unable to send quick reply. Please try again.")),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final readOnly = widget.readOnly ||
        _conversationStatus == "Closed" ||
        _conversationStatus == "Archived" ||
        !_actions.openThread;
    return Scaffold(
      body: Column(
        children: [
          EyePageHeader.secondary(
            title: "Communication",
            onBack: () => Navigator.of(context).maybePop(),
          ),
          if (readOnly)
            Semantics(
              liveRegion: true,
              label:
                  "This incident has been resolved. The communication record is now read-only.",
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
          if (_pendingInformationRequestPrompt != null && !readOnly)
            Semantics(
              liveRegion: true,
              label: "Information requested: $_pendingInformationRequestPrompt",
              child: Material(
                color: Theme.of(context).colorScheme.errorContainer,
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Text(
                    "Information requested: $_pendingInformationRequestPrompt",
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ),
              ),
            ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(child: Text(_error!))
                    : _messages.isEmpty
                        ? ListView(
                            padding: const EdgeInsets.all(24),
                            children: const [
                              Text(
                                "No messages yet.\nIf responders need more information, their messages will appear here. You can also send an update about your emergency.",
                                textAlign: TextAlign.center,
                              ),
                            ],
                          )
                        : ListView.builder(
                            controller: _scrollController,
                            padding: const EdgeInsets.all(16),
                            itemCount: _messages.length,
                            itemBuilder: (context, index) {
                              final message = _messages[index];
                              final isOfficial =
                                  message.senderRole != "Reporter";
                              final friendlyTime =
                                  CitizenDateTimeFormatter.formatFriendly(
                                message.createdAt,
                              );
                              return Semantics(
                                label:
                                    "${message.senderLabel}, ${message.messageType}, $friendlyTime",
                                child: Align(
                                  alignment: isOfficial
                                      ? Alignment.centerLeft
                                      : Alignment.centerRight,
                                  child: Container(
                                    margin: const EdgeInsets.only(bottom: 12),
                                    padding: const EdgeInsets.all(12),
                                    constraints:
                                        const BoxConstraints(maxWidth: 320),
                                    decoration: BoxDecoration(
                                      color: isOfficial
                                          ? Theme.of(context)
                                              .colorScheme
                                              .surfaceContainerHighest
                                          : Theme.of(context)
                                              .colorScheme
                                              .primaryContainer,
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          message.senderLabel,
                                          style: Theme.of(context)
                                              .textTheme
                                              .labelLarge,
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          friendlyTime,
                                          style: Theme.of(context)
                                              .textTheme
                                              .bodySmall,
                                        ),
                                        const SizedBox(height: 4),
                                        Text(message.body),
                                        const SizedBox(height: 4),
                                        Text(
                                          message.deliveryState ?? "Sent",
                                          style: Theme.of(context)
                                              .textTheme
                                              .bodySmall,
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
                      if (_actions.sendPhoto)
                        Semantics(
                          button: true,
                          label: "Send photo",
                          child: OutlinedButton.icon(
                            onPressed:
                                _sending ? null : () => unawaited(_pickPhoto()),
                            icon: const Icon(Icons.photo_camera_outlined),
                            label: const Text("Photo"),
                          ),
                        ),
                      if (_actions.sendVoice)
                        Semantics(
                          button: true,
                          label: "Send voice message",
                          child: OutlinedButton.icon(
                            onPressed: _sending
                                ? null
                                : () => unawaited(_recordVoice()),
                            icon: const Icon(Icons.mic_none),
                            label: const Text("Voice"),
                          ),
                        ),
                      if (_actions.sendLocation)
                        Semantics(
                          button: true,
                          label: "Share current location",
                          child: OutlinedButton.icon(
                            onPressed: _sending
                                ? null
                                : () => unawaited(_sendLocationUpdate()),
                            icon: const Icon(Icons.my_location),
                            label: const Text("Location"),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
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
                            onPressed:
                                _sending ? null : () => _sendQuickReply(action),
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
                          onPressed:
                              _sending || !_actions.sendText ? null : _sendText,
                          child: _sending
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2),
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
