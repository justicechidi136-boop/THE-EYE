import "dart:async";

import "package:flutter/material.dart";
import "package:geolocator/geolocator.dart";
import "package:uuid/uuid.dart";

import "../contracts/the_eye_api_client.dart";
import "../design_system/eye_semantic_colors.dart";
import "../evidence/evidence_attachment_picker.dart";
import "../evidence/evidence_upload_service.dart";
import "../evidence/local_evidence_attachment.dart";
import "../voice/voice_recorder.dart";
import "../voice/voice_report_validation.dart";
import "active_emergency_contract.dart";
import "active_emergency_service.dart";
import "incident_communication_contract.dart";
import "incident_communication_service.dart";
import "widgets/communication_composer.dart";
import "widgets/communication_header.dart";
import "widgets/communication_live_rail.dart";
import "widgets/communication_message_card.dart";
import "widgets/communication_tabs.dart";
import "widgets/emergency_status_update_card.dart";

/// Phase 6 incident communication UI — presentation matched to the Claude
/// Active Emergency Communication layer. Backend contracts/services unchanged.
class IncidentCommunicationScreen extends StatefulWidget {
  const IncidentCommunicationScreen({
    super.key,
    required this.incidentId,
    required this.accessToken,
    required this.apiClient,
    this.readOnly = false,
    this.publicReference,
    this.locationLabel,
    this.reportedAt,
    this.confirmStillOngoing = false,
    this.confirmResolved = false,
  });

  final String incidentId;
  final String accessToken;
  final TheEyeApiClient apiClient;
  final bool readOnly;
  final String? publicReference;
  final String? locationLabel;
  final DateTime? reportedAt;
  final bool confirmStillOngoing;
  final bool confirmResolved;

  @override
  State<IncidentCommunicationScreen> createState() =>
      _IncidentCommunicationScreenState();
}

class _IncidentCommunicationScreenState
    extends State<IncidentCommunicationScreen> {
  late final IncidentCommunicationService _service;
  late final ActiveEmergencyService _activeEmergencyService;
  final _composerController = TextEditingController();
  final _scrollController = ScrollController();
  List<IncidentThreadMessage> _messages = const [];
  List<QueuedIncidentMessage> _offlineQueue = const [];
  IncidentCommunicationAllowedActions _actions =
      IncidentCommunicationAllowedActions.empty();
  bool _loading = true;
  String? _error;
  bool _sending = false;
  bool _stale = false;
  String? _pendingInformationRequestId;
  String? _pendingInformationRequestPrompt;
  Timer? _pollTimer;
  String _conversationStatus = "Active";
  late final EvidenceUploadService _uploadService;
  CommunicationThreadTab _tab = CommunicationThreadTab.all;

  @override
  void initState() {
    super.initState();
    _service = IncidentCommunicationService(widget.apiClient);
    _activeEmergencyService =
        ActiveEmergencyService(apiClient: widget.apiClient);
    _uploadService = EvidenceUploadService(apiClient: widget.apiClient);
    unawaited(_refresh(initial: true));
    if (!widget.readOnly) {
      _pollTimer = Timer.periodic(
        const Duration(seconds: 10),
        (_) => unawaited(_refresh()),
      );
    }
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _composerController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  String? get _subtitle {
    final ref = widget.publicReference?.trim();
    final loc = widget.locationLabel?.trim();
    if (ref != null && ref.isNotEmpty && loc != null && loc.isNotEmpty) {
      return "$ref · $loc";
    }
    return ref ?? loc;
  }

  Future<void> _refresh({bool initial = false}) async {
    if (!mounted) return;
    if (initial) setState(() => _loading = true);
    try {
      if (!widget.readOnly) {
        await _service.flushQueue(
          widget.incidentId,
          widget.accessToken,
          uploadService: _uploadService,
        );
      }
      final conversation = await _service.fetchConversation(
        widget.incidentId,
        widget.accessToken,
      );
      final messages = await _service.fetchMessages(
        widget.incidentId,
        widget.accessToken,
      );
      final queue = widget.readOnly
          ? const <QueuedIncidentMessage>[]
          : await _service.loadQueue();
      if (!mounted) return;
      setState(() {
        _messages = messages.reversed.toList(growable: false);
        _offlineQueue = queue
            .where((item) => item.incidentId == widget.incidentId)
            .toList(growable: false);
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
        _stale = false;
        _loading = false;
      });
      if (!widget.readOnly) await _markOfficialMessagesRead(_messages);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = "Unable to load communication thread.";
        _stale = _messages.isNotEmpty || _offlineQueue.isNotEmpty;
        _loading = false;
      });
    }
  }

  List<IncidentThreadMessage> get _filteredMessages {
    Iterable<IncidentThreadMessage> rows = _messages;
    switch (_tab) {
      case CommunicationThreadTab.all:
        break;
      case CommunicationThreadTab.mine:
        rows = rows.where((m) => m.senderRole == "Reporter");
      case CommunicationThreadTab.responders:
        rows = rows.where(
          (m) =>
              m.senderRole == "Agency" ||
              m.senderRole == "Dispatcher" ||
              m.senderRole == "Responder",
        );
    }
    return rows.toList(growable: false);
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
      _composerController.clear();
      await _refresh();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              "Message queued offline and will retry automatically.",
            ),
          ),
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
    String messageType,
    LocalEvidenceAttachment attachment,
  ) async {
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
      await _refresh();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              "Media queued offline and will retry automatically.",
            ),
          ),
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
      backgroundColor: EyeSemanticColors.of(context).cardSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
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

  Future<void> _showAttachSheet() async {
    if (widget.readOnly) return;
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: EyeSemanticColors.of(context).cardSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_actions.sendPhoto)
                  ListTile(
                    leading: const Icon(Icons.photo_camera_outlined),
                    title: const Text("Photo"),
                    onTap: () {
                      Navigator.pop(context);
                      unawaited(_pickPhoto());
                    },
                  ),
                if (_actions.sendVoice)
                  ListTile(
                    leading: const Icon(Icons.mic_none),
                    title: const Text("Voice message"),
                    onTap: () {
                      Navigator.pop(context);
                      unawaited(_recordVoice());
                    },
                  ),
                if (_actions.sendLocation)
                  ListTile(
                    leading: const Icon(Icons.my_location),
                    title: const Text("Share location"),
                    onTap: () {
                      Navigator.pop(context);
                      unawaited(_sendLocationUpdate());
                    },
                  ),
              ],
            ),
          ),
        );
      },
    );
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
            content: Text("Unable to share location. Please try again."),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _markOfficialMessagesRead(
    List<IncidentThreadMessage> messages,
  ) async {
    for (final message in messages) {
      if (message.senderRole == "Reporter") continue;
      if (message.deliveryState == "Read") continue;
      try {
        await _service.markRead(
          widget.incidentId,
          message.id,
          widget.accessToken,
        );
      } catch (_) {
        // Non-fatal; unread badge may lag until next refresh.
      }
    }
  }

  Future<void> _submitReporterStatus(String status) async {
    try {
      await _activeEmergencyService.submitReporterStatus(
        widget.incidentId,
        widget.accessToken,
        status: status,
        clientActionId:
            "comm-${status.toLowerCase()}-${DateTime.now().millisecondsSinceEpoch}",
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Status update sent.")),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("Unable to update status. Please try again."),
          ),
        );
      }
    }
  }

  void _onPlayVoice(IncidentThreadMessage message) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          "Voice playback opens when a secure media link is available.",
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    final readOnly = widget.readOnly ||
        _conversationStatus == "Closed" ||
        _conversationStatus == "Archived" ||
        !_actions.openThread;
    final showStatus =
        !readOnly && (widget.confirmStillOngoing || widget.confirmResolved);
    final filtered = _filteredMessages;
    final queuedForIncident = _offlineQueue;

    return Scaffold(
      backgroundColor: colors.background,
      body: Column(
        children: [
          CommunicationHeader(
            title: "Communication",
            subtitle: _subtitle,
            onBack: () => Navigator.of(context).maybePop(),
          ),
          CommunicationLiveRail(reportedAt: widget.reportedAt),
          if (readOnly)
            Semantics(
              liveRegion: true,
              label:
                  "This incident has been resolved. The communication record is now read-only.",
              child: Material(
                color: colors.elevatedSurface,
                child: const Padding(
                  padding: EdgeInsets.all(12),
                  child: Text(
                    "This incident has been resolved. The communication record is now read-only.",
                  ),
                ),
              ),
            ),
          if (_pendingInformationRequestPrompt != null && !readOnly)
            Material(
              color: colors.error.withValues(alpha: 0.12),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Text(
                  "Information requested: $_pendingInformationRequestPrompt",
                  style: TextStyle(color: colors.bodyText, fontSize: 13),
                ),
              ),
            ),
          if (_stale || (_error != null && filtered.isNotEmpty))
            Material(
              color: colors.warning.withValues(alpha: 0.12),
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        _stale
                            ? "Showing cached messages. Information may be out of date."
                            : (_error ?? ""),
                        style: TextStyle(color: colors.bodyText, fontSize: 12),
                      ),
                    ),
                    TextButton(
                      onPressed: () => unawaited(_refresh()),
                      child: const Text("Retry"),
                    ),
                  ],
                ),
              ),
            ),
          if (queuedForIncident.isNotEmpty)
            Material(
              color: colors.information.withValues(alpha: 0.12),
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Text(
                  "${queuedForIncident.length} message${queuedForIncident.length == 1 ? "" : "s"} waiting to send when you are back online.",
                  style: TextStyle(color: colors.bodyText, fontSize: 12),
                ),
              ),
            ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null &&
                        filtered.isEmpty &&
                        queuedForIncident.isEmpty
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                _error!,
                                textAlign: TextAlign.center,
                                style: TextStyle(color: colors.errorText),
                              ),
                              const SizedBox(height: 12),
                              FilledButton(
                                onPressed: () => unawaited(_refresh()),
                                child: const Text("Retry"),
                              ),
                            ],
                          ),
                        ),
                      )
                    : ListView(
                        controller: _scrollController,
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                        children: [
                          CommunicationTabs(
                            value: _tab,
                            onChanged: (tab) => setState(() => _tab = tab),
                          ),
                          const SizedBox(height: 12),
                          if (filtered.isEmpty && queuedForIncident.isEmpty)
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 28),
                              child: Text(
                                readOnly
                                    ? "No communication history was recorded for this incident."
                                    : "No messages yet.\nIf responders need more information, their messages will appear here. You can also send an update about your emergency.",
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  color: colors.mutedText,
                                  fontSize: 13,
                                  height: 1.4,
                                ),
                              ),
                            )
                          else ...[
                            for (final message in filtered) ...[
                              CommunicationMessageCard(
                                message: message,
                                onPlayVoice: message.messageType == "Voice"
                                    ? () => _onPlayVoice(message)
                                    : null,
                              ),
                              const SizedBox(height: 12),
                            ],
                            for (final queued in queuedForIncident) ...[
                              CommunicationMessageCard(
                                queued: true,
                                message: IncidentThreadMessage(
                                  id: queued.clientMessageId,
                                  messageType: queued.messageType,
                                  body: queued.body,
                                  senderRole: "Reporter",
                                  senderLabel: "You",
                                  createdAt: queued.createdAt,
                                  deliveryState: "Queued",
                                  clientMessageId: queued.clientMessageId,
                                ),
                              ),
                              const SizedBox(height: 12),
                            ],
                          ],
                          if (showStatus) ...[
                            const SizedBox(height: 4),
                            EmergencyStatusUpdateCard(
                              allowedActions: ActiveEmergencyAllowedActions(
                                addEvidence: false,
                                uploadPhoto: false,
                                uploadVideo: false,
                                uploadVoice: false,
                                addUpdate: false,
                                cancel: false,
                                requestCancellation: false,
                                confirmResolved: widget.confirmResolved,
                                confirmStillOngoing: widget.confirmStillOngoing,
                                addWrittenUpdate: false,
                                updateLocation: false,
                                retryLiveVideo: false,
                              ),
                              busy: _sending,
                              onOngoing: () => unawaited(
                                _submitReporterStatus("StillOngoing"),
                              ),
                              onResolved: () => unawaited(
                                _submitReporterStatus("Resolved"),
                              ),
                              onUnsafe: () => unawaited(
                                _submitReporterStatus("Unsure"),
                              ),
                            ),
                          ],
                        ],
                      ),
          ),
          if (!readOnly)
            CommunicationComposer(
              controller: _composerController,
              enabled: !readOnly,
              sending: _sending,
              canSendText: _actions.sendText,
              canSendPhoto: _actions.sendPhoto,
              canSendVoice: _actions.sendVoice,
              onSend: () => unawaited(_sendText()),
              onAttach: () => unawaited(_showAttachSheet()),
              onPhoto: () => unawaited(_pickPhoto()),
              onVoice: () => unawaited(_recordVoice()),
            ),
        ],
      ),
    );
  }
}
