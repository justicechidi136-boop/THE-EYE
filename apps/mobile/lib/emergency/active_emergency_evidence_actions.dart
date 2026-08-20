import "dart:async";

import "package:flutter/material.dart";
import "package:flutter/semantics.dart";
import "package:flutter/services.dart";

import "../contracts/the_eye_api_client.dart";
import "../evidence/evidence_attachment_picker.dart";
import "../evidence/evidence_upload_coordinator.dart";
import "../evidence/evidence_upload_service.dart";
import "../evidence/local_evidence_attachment.dart";
import "active_emergency_contract.dart";

typedef ActiveEmergencyUploadCallback = Future<bool> Function({
  required bool closeSheet,
});

bool shouldRefreshAfterEvidenceUpload(EvidenceUploadBatchResult batch) =>
    batch.uploaded.isNotEmpty;

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
  final ActiveEmergencyUploadCallback onUploaded;
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
  late final EvidenceUploadCoordinator _uploadCoordinator =
      EvidenceUploadCoordinator(
    uploadService: EvidenceUploadService(apiClient: widget.apiClient),
  );
  bool _uploading = false;
  String? _statusMessage;
  int _attachmentCount = 0;
  final List<LocalEvidenceAttachment> _offlineQueue = [];

  static const _emptyUploadMessage =
      "Please select at least one piece of evidence to upload.";

  void _onAttachmentsChanged(int count) {
    if (_attachmentCount == count) return;
    setState(() => _attachmentCount = count);
  }

  Future<void> _announceStatus(String message) async {
    if (!mounted) return;
    SemanticsService.sendAnnouncement(
      View.of(context),
      message,
      TextDirection.ltr,
    );
  }

  Future<void> _handleEmptyUploadAttempt() async {
    setState(() => _statusMessage = _emptyUploadMessage);
    await _announceStatus(_emptyUploadMessage);
  }

  Future<void> _uploadAttachments(
      List<LocalEvidenceAttachment> attachments) async {
    if (attachments.isEmpty) {
      await _handleEmptyUploadAttempt();
      return;
    }
    if (_uploading) return;
    setState(() {
      _uploading = true;
      _statusMessage = "Uploading evidence...";
    });
    try {
      final batch = await _uploadCoordinator.uploadForIncident(
        incidentId: widget.incidentId,
        attachments: attachments,
        accessToken: widget.accessToken,
        fallbackLatitude: null,
        fallbackLongitude: null,
        onProgress: (localId, progress) {
          _evidenceKey.currentState?.markUploading(localId, progress);
        },
      );

      for (final reference in batch.uploaded) {
        final localId = reference.clientAttachmentId;
        if (localId == null || localId.isEmpty) continue;
        _evidenceKey.currentState?.markUploaded(localId);
        _offlineQueue.removeWhere((item) => item.localId == localId);
      }

      for (final failure in batch.failures) {
        _evidenceKey.currentState?.markUploadFailed(
          failure.localId,
          failure.userMessage ?? "Upload failed.",
        );
        if (_offlineQueue.any((item) => item.localId == failure.localId)) {
          continue;
        }
        for (final attachment in attachments) {
          if (attachment.localId == failure.localId) {
            _offlineQueue.add(attachment);
            break;
          }
        }
      }

      if (mounted) {
        var refreshed = true;
        if (batch.isFullSuccess) {
          HapticFeedback.lightImpact();
          setState(() => _statusMessage = "Evidence uploaded.");
        } else if (batch.isPartialSuccess) {
          setState(() => _statusMessage =
              "${batch.uploaded.length} uploaded, ${batch.failures.length} failed. Retry queued items.");
        } else {
          setState(
              () => _statusMessage = "Upload failed. Will retry when online.");
        }
        if (shouldRefreshAfterEvidenceUpload(batch)) {
          refreshed = await widget.onUploaded(
            closeSheet: batch.isFullSuccess,
          );
        }
        if (!refreshed && mounted) {
          setState(() {
            _statusMessage =
                "Evidence uploaded, but the latest incident view could not be refreshed. Pull to refresh.";
          });
        }
      }
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
        setState(
            () => _statusMessage = "Upload failed. Will retry when online.");
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
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
          decoration:
              const InputDecoration(labelText: "Additional information"),
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
      final refreshed = await widget.onUploaded(closeSheet: true);
      if (mounted) {
        setState(() => _statusMessage = refreshed
            ? "Update sent."
            : "Update sent, but the latest incident view could not be refreshed. Pull to refresh.");
      }
    } catch (_) {
      if (mounted) setState(() => _statusMessage = "Unable to send update.");
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final actions = widget.allowedActions;
    final showEvidence = actions.addEvidence ||
        actions.uploadPhoto ||
        actions.uploadVideo ||
        actions.uploadVoice;
    final hasAttachments = _attachmentCount > 0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_statusMessage != null)
          Semantics(
            liveRegion: true,
            child: Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(_statusMessage!),
            ),
          ),
        if (showEvidence) ...[
          Text("Add more evidence",
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Semantics(
            label: "Add photo, video, or audio evidence",
            child: ManagedEvidenceSection(
              key: _evidenceKey,
              lowDataMode: widget.lowDataMode,
              onAttachmentsChanged: _onAttachmentsChanged,
            ),
          ),
          const SizedBox(height: 8),
          if (actions.uploadPhoto || actions.uploadVideo)
            FilledButton.tonal(
              onPressed: _uploading || !hasAttachments
                  ? null
                  : () async {
                      final attachments =
                          _evidenceKey.currentState?.attachments ?? [];
                      if (attachments.isEmpty) {
                        await _handleEmptyUploadAttempt();
                        return;
                      }
                      await _uploadAttachments(attachments);
                    },
              child: Text(
                  _uploading ? "Uploading..." : "Upload selected evidence"),
            ),
        ],
        // Voice capture lives inside ManagedEvidenceSection to avoid duplicate recorders.
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
