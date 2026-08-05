import "dart:async";

import "package:flutter/material.dart";
import "package:flutter/services.dart";

import "../contracts/the_eye_api_client.dart";
import "../evidence/evidence_attachment_picker.dart";
import "../evidence/evidence_upload_service.dart";
import "../evidence/local_evidence_attachment.dart";
import "../voice/voice_recorder.dart";
import "../voice/voice_report_validation.dart";
import "active_emergency_contract.dart";

class ActiveEmergencyEvidenceActions extends StatefulWidget {
  const ActiveEmergencyEvidenceActions({
    super.key,
    required this.incidentId,
    required this.accessToken,
    required this.allowedActions,
    required this.apiClient,
    required this.onUploaded,
    this.lowDataMode = false,
    this.accessibilityVoiceGuidance = false,
  });

  final String incidentId;
  final String accessToken;
  final ActiveEmergencyAllowedActions allowedActions;
  final TheEyeApiClient apiClient;
  final Future<void> Function() onUploaded;
  final bool lowDataMode;
  final bool accessibilityVoiceGuidance;

  @override
  State<ActiveEmergencyEvidenceActions> createState() =>
      _ActiveEmergencyEvidenceActionsState();
}

class _ActiveEmergencyEvidenceActionsState
    extends State<ActiveEmergencyEvidenceActions> {
  final GlobalKey<ManagedEvidenceSectionState> _evidenceKey =
      GlobalKey<ManagedEvidenceSectionState>();
  late final EvidenceUploadService _uploadService =
      EvidenceUploadService(apiClient: widget.apiClient);
  bool _uploading = false;
  String? _statusMessage;
  final List<LocalEvidenceAttachment> _offlineQueue = [];

  Future<void> _uploadAttachments(List<LocalEvidenceAttachment> attachments) async {
    if (attachments.isEmpty || _uploading) return;
    setState(() {
      _uploading = true;
      _statusMessage = "Uploading evidence...";
    });
    try {
      await _uploadService.uploadForIncident(
        incidentId: widget.incidentId,
        attachments: attachments,
        accessToken: widget.accessToken,
        fallbackLatitude: null,
        fallbackLongitude: null,
        onProgress: (localId, progress) {
          _evidenceKey.currentState?.markUploading(localId, progress);
        },
      );
      for (final attachment in attachments) {
        _evidenceKey.currentState?.markUploaded(attachment.localId);
        _offlineQueue.removeWhere((item) => item.localId == attachment.localId);
      }
      HapticFeedback.lightImpact();
      if (mounted) {
        setState(() => _statusMessage = "Evidence uploaded.");
      }
      await widget.onUploaded();
    } catch (error) {
      for (final attachment in attachments) {
        _evidenceKey.currentState?.markUploadFailed(
          attachment.localId,
          error.toString(),
        );
        if (!_offlineQueue.any((item) => item.localId == attachment.localId)) {
          _offlineQueue.add(attachment);
        }
      }
      if (mounted) {
        setState(() => _statusMessage = "Upload failed. Will retry when online.");
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _uploadQueuedVoice(VoiceRecordingResult recording) async {
    await _uploadAttachments([recording.attachment]);
  }

  Future<void> _retryOfflineQueue() async {
    if (_offlineQueue.isEmpty) return;
    final pending = List<LocalEvidenceAttachment>.from(_offlineQueue);
    await _uploadAttachments(pending);
  }

  Future<void> _submitWrittenUpdate() async {
    final controller = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Add update"),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(labelText: "Additional information"),
          minLines: 3,
          maxLines: 6,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text("Cancel"),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text("Submit"),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    final text = controller.text.trim();
    if (text.isEmpty) return;
    setState(() {
      _uploading = true;
      _statusMessage = "Sending update...";
    });
    try {
      await widget.apiClient.postJson(
        "/incidents/${widget.incidentId}/updates",
        {
          "text": text,
          "clientActionId": "update-${DateTime.now().millisecondsSinceEpoch}",
        },
        accessToken: widget.accessToken,
      );
      HapticFeedback.lightImpact();
      await widget.onUploaded();
      if (mounted) setState(() => _statusMessage = "Update sent.");
    } catch (_) {
      if (mounted) setState(() => _statusMessage = "Unable to send update.");
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final actions = widget.allowedActions;
    final showEvidence =
        actions.addEvidence || actions.uploadPhoto || actions.uploadVideo;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_statusMessage != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(_statusMessage!),
          ),
        if (showEvidence) ...[
          Semantics(
            label: "Add photo or video evidence",
            child: ManagedEvidenceSection(
              key: _evidenceKey,
              lowDataMode: widget.lowDataMode,
            ),
          ),
          const SizedBox(height: 8),
          if (actions.uploadPhoto || actions.uploadVideo)
            FilledButton.tonal(
              onPressed: _uploading
                  ? null
                  : () async {
                      final attachments =
                          _evidenceKey.currentState?.attachments ?? [];
                      if (attachments.isEmpty) {
                        setState(() => _statusMessage =
                            "Capture or pick evidence first, then upload.");
                        return;
                      }
                      await _uploadAttachments(attachments);
                    },
              child: Text(_uploading ? "Uploading..." : "Upload selected evidence"),
            ),
        ],
        if (actions.uploadVoice) ...[
          const SizedBox(height: 12),
          Semantics(
            label: "Record voice update",
            child: VoiceRecorder(
              accessibilityVoiceGuidance: widget.accessibilityVoiceGuidance,
              enabled: !_uploading,
              onRecordingReady: (recording) async {
                setState(() => _statusMessage = "Uploading voice update...");
                await _uploadQueuedVoice(recording);
              },
            ),
          ),
        ],
        if (actions.addUpdate || actions.addWrittenUpdate) ...[
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: _uploading ? null : _submitWrittenUpdate,
            child: const Text("Add written update"),
          ),
        ],
        if (_offlineQueue.isNotEmpty) ...[
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: _uploading ? null : _retryOfflineQueue,
            child: Text("Retry ${_offlineQueue.length} queued upload(s)"),
          ),
        ],
      ],
    );
  }
}
