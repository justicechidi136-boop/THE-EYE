import "package:flutter/material.dart";

import "../contracts/the_eye_api_client.dart";
import "../evidence/evidence_attachment_picker.dart";
import "community_media_upload_service.dart";
import "community_members_screen.dart";
import "neighborhood_watch_service.dart";

class CommunityReportScreen extends StatefulWidget {
  const CommunityReportScreen({
    required this.accessToken,
    required this.args,
    super.key,
  });

  final String accessToken;
  final CommunityReportRouteArgs args;

  @override
  State<CommunityReportScreen> createState() => _CommunityReportScreenState();
}

class _CommunityReportScreenState extends State<CommunityReportScreen> {
  final NeighborhoodWatchService _service = NeighborhoodWatchService();
  final CommunityMediaUploadService _mediaUploadService =
      CommunityMediaUploadService();
  final _noteController = TextEditingController();
  final _evidenceKey = GlobalKey<ManagedEvidenceSectionState>();
  String _reasonCode = communityReportReasons.first;
  bool _submitting = false;
  String? _resultMessage;
  bool _success = false;

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _submitting = true;
      _resultMessage = null;
    });
    try {
      String? evidenceObjectKey;
      String? evidenceBucket;
      final attachments = _evidenceKey.currentState?.attachments ?? const [];
      if (attachments.isNotEmpty) {
        final uploaded = await _mediaUploadService.uploadForPost(
          communityId: widget.args.communityId,
          attachments: attachments,
          accessToken: widget.accessToken,
          onProgress: (localId, progress) =>
              _evidenceKey.currentState?.markUploading(localId, progress),
        );
        if (uploaded.isNotEmpty) {
          evidenceObjectKey = uploaded.first.objectKey;
          evidenceBucket = uploaded.first.bucket;
        }
      }
      await _service.submitReport(
        accessToken: widget.accessToken,
        communityId: widget.args.communityId,
        targetType: widget.args.targetType,
        targetId: widget.args.targetId,
        reasonCode: _reasonCode,
        note: _reasonCode == "Other"
            ? _noteController.text.trim()
            : (_noteController.text.trim().isEmpty
                ? null
                : _noteController.text.trim()),
        evidenceObjectKey: evidenceObjectKey,
        evidenceBucket: evidenceBucket,
      );
      if (!mounted) return;
      setState(() {
        _success = true;
        _resultMessage = "Report submitted. Moderators will review it.";
      });
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _success = false;
        _resultMessage = error.userMessage;
      });
    } on CommunityMediaUploadFailure catch (error) {
      if (!mounted) return;
      setState(() {
        _success = false;
        _resultMessage = error.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _success = false;
        _resultMessage = "Unable to submit report.";
      });
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Report content")),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          Text("Reporting: ${widget.args.targetLabel}"),
          Text("Type: ${widget.args.targetType}"),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            value: _reasonCode,
            items: communityReportReasons
                .map((reason) =>
                    DropdownMenuItem(value: reason, child: Text(reason)))
                .toList(),
            onChanged: (value) =>
                setState(() => _reasonCode = value ?? _reasonCode),
            decoration: const InputDecoration(labelText: "Reason"),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _noteController,
            maxLines: 4,
            decoration: InputDecoration(
              labelText: _reasonCode == "Other"
                  ? "Describe the issue"
                  : "Additional details (optional)",
            ),
          ),
          const SizedBox(height: 12),
          ManagedEvidenceSection(key: _evidenceKey, lowDataMode: false),
          const SizedBox(height: 12),
          if (_resultMessage != null)
            Text(
              _resultMessage!,
              style: TextStyle(
                color: _success ? Colors.green.shade700 : Colors.red.shade700,
              ),
            ),
          FilledButton(
            onPressed: _submitting ? null : _submit,
            child: _submitting
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text("Submit report"),
          ),
        ],
      ),
    );
  }
}
