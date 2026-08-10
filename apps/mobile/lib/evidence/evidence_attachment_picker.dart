import "package:flutter/material.dart";
import "package:permission_handler/permission_handler.dart";

import "evidence_capture_controller.dart";
import "evidence_capture_service.dart";
import "evidence_media_source.dart";
import "evidence_permission_service.dart";
import "local_evidence_attachment.dart";
import "../design_system/components/eye_evidence_card.dart";
import "../design_system/eye_semantic_colors.dart";
import "../presentation/evidence_presentation.dart";
import "../voice/voice_consent_banner.dart";
import "../voice/voice_recorder.dart";
import "../widgets/section_card.dart";

class ManagedEvidenceSection extends StatefulWidget {
  const ManagedEvidenceSection({
    required this.lowDataMode,
    this.figmaStyle = false,
    super.key,
  });

  final bool lowDataMode;
  final bool figmaStyle;

  @override
  State<ManagedEvidenceSection> createState() => ManagedEvidenceSectionState();
}

class ManagedEvidenceSectionState extends State<ManagedEvidenceSection> {
  EvidenceCaptureController? _controller;

  List<LocalEvidenceAttachment> get attachments =>
      List<LocalEvidenceAttachment>.from(_controller?.attachments ?? const []);

  void markUploading(String localId, double progress) =>
      _controller?.markUploading(localId, progress);
  void markUploaded(String localId) => _controller?.markUploaded(localId);
  void markUploadFailed(String localId, String message) =>
      _controller?.markUploadFailed(localId, message);

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    _controller ??= createEvidenceCaptureController(context,
        lowDataMode: widget.lowDataMode);
    final picker = EvidenceAttachmentPicker(
      controller: _controller!,
      lowDataMode: widget.lowDataMode,
      figmaStyle: widget.figmaStyle,
    );
    if (!widget.figmaStyle) {
      return SectionCard(
        title: "Evidence",
        child: picker,
      );
    }
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(8, 12, 8, 12),
      decoration: BoxDecoration(
        color: EyeSemanticColors.of(context).cardSurface,
        borderRadius: BorderRadius.circular(8),
        boxShadow: const [
          BoxShadow(
            color: Color(0x40000000),
            blurRadius: 4,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            "Upload photos (JPEG, PNG, WEBP)",
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 12),
          picker,
        ],
      ),
    );
  }
}

Future<bool> presentEvidencePermissionRationale(
  BuildContext context, {
  required String title,
  required String message,
  required bool showSettingsLink,
}) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (context) {
      return AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text("Not now")),
          if (showSettingsLink)
            TextButton(
              onPressed: () async {
                await openAppSettings();
                if (context.mounted) Navigator.of(context).pop(false);
              },
              child: const Text("Open settings"),
            ),
          FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text("Continue")),
        ],
      );
    },
  );
  return result ?? false;
}

EvidenceCaptureController createEvidenceCaptureController(
  BuildContext context, {
  bool lowDataMode = false,
  double? latitude,
  double? longitude,
}) {
  return EvidenceCaptureController(
    captureService: EvidenceCaptureService(),
    mediaSource: ImagePickerEvidenceSource(),
    permissionService: EvidencePermissionService(),
    lowDataMode: lowDataMode,
    latitude: latitude,
    longitude: longitude,
    rationalePresenter: (
        {required title, required message, required showSettingsLink}) {
      return presentEvidencePermissionRationale(
        context,
        title: title,
        message: message,
        showSettingsLink: showSettingsLink,
      );
    },
  );
}

class EvidenceAttachmentPicker extends StatelessWidget {
  const EvidenceAttachmentPicker({
    required this.controller,
    required this.lowDataMode,
    this.figmaStyle = false,
    super.key,
  });

  final EvidenceCaptureController controller;
  final bool lowDataMode;
  final bool figmaStyle;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        controller.lowDataMode = lowDataMode;
        final hasVoiceAttachment =
            controller.attachments.any((attachment) => attachment.isAudio);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const VoiceConsentBanner(),
            if (!hasVoiceAttachment) ...[
              const SizedBox(height: 12),
              VoiceRecorder(
                enabled: !controller.busy && controller.canAddMore,
                onRecordingReady: (result) =>
                    controller.addVoiceAttachment(result.attachment),
                onRecordingRemoved: () {},
              ),
            ],
            if (figmaStyle) ...[
              Material(
                color: EyeSemanticColors.of(context).elevatedSurface,
                borderRadius: BorderRadius.circular(8),
                child: InkWell(
                  onTap: controller.busy || !controller.canAddMore
                      ? null
                      : () => _showPhotoActions(context),
                  borderRadius: BorderRadius.circular(8),
                  child: SizedBox(
                    height: 94,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.upload_rounded,
                          color: EyeSemanticColors.of(context).interactiveText,
                          size: 24,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          "Click here to upload",
                          style: TextStyle(
                            fontSize: 12,
                            color: EyeSemanticColors.of(context).bodyText,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                "Uploaded files",
                style: TextStyle(
                  fontSize: 14,
                  color: EyeSemanticColors.of(context).bodyText,
                ),
              ),
              const SizedBox(height: 8),
            ] else
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  AttachmentChip(
                    Icons.photo_camera,
                    "Photo",
                    enabled: !controller.busy && controller.canAddMore,
                    onPressed: () => _showPhotoActions(context),
                  ),
                  AttachmentChip(
                    Icons.videocam,
                    "Video",
                    enabled: !controller.busy && controller.canAddMore,
                    onPressed: () => _showVideoActions(context),
                  ),
                  AttachmentChip(
                    Icons.mic,
                    "Audio",
                    enabled: !controller.busy && controller.canAddMore,
                    onPressed: controller.pickAudio,
                  ),
                ],
              ),
            if (controller.busy) ...[
              const SizedBox(height: 12),
              const LinearProgressIndicator(),
              const SizedBox(height: 8),
              const Text("Preparing evidence...",
                  style: TextStyle(fontWeight: FontWeight.w700)),
            ],
            if (controller.lastError != null) ...[
              const SizedBox(height: 12),
              Text(controller.lastError!,
                  style: const TextStyle(
                      color: Color(0xFFB00020), fontWeight: FontWeight.w700)),
            ],
            if (lowDataMode)
              const Padding(
                padding: EdgeInsets.only(top: 12),
                child: Text("Low-data mode will compress media before upload."),
              ),
            if (controller.attachments.isNotEmpty) ...[
              const SizedBox(height: 14),
              ...() {
                final presentations =
                    EvidencePresentationMapper.mapLocalAttachments(
                  controller.attachments,
                );
                return [
                  for (var i = 0; i < presentations.length; i++)
                    EyeEvidenceCard(
                      presentation: presentations[i],
                      uploadProgress: controller.attachments[i].uploadProgress,
                      onView: presentations[i].canView ? () {} : null,
                      onPlay: presentations[i].canPlay ? () {} : null,
                      onRemove: () =>
                          controller.remove(controller.attachments[i].localId),
                      onRetry: presentations[i].canRetry
                          ? () => controller.retryFailedUpload(
                                controller.attachments[i].localId,
                              )
                          : null,
                    ),
                ];
              }(),
            ],
          ],
        );
      },
    );
  }

  Future<void> _showPhotoActions(BuildContext context) async {
    await showModalBottomSheet<void>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
                leading: const Icon(Icons.photo_camera),
                title: const Text("Take photo"),
                onTap: () {
                  Navigator.pop(context);
                  controller.takePhoto();
                }),
            ListTile(
                leading: const Icon(Icons.photo_library),
                title: const Text("Choose image"),
                onTap: () {
                  Navigator.pop(context);
                  controller.pickImage();
                }),
          ],
        ),
      ),
    );
  }

  Future<void> _showVideoActions(BuildContext context) async {
    await showModalBottomSheet<void>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
                leading: const Icon(Icons.videocam),
                title: const Text("Record video"),
                onTap: () {
                  Navigator.pop(context);
                  controller.recordVideo();
                }),
            ListTile(
                leading: const Icon(Icons.video_library),
                title: const Text("Choose video"),
                onTap: () {
                  Navigator.pop(context);
                  controller.pickVideo();
                }),
          ],
        ),
      ),
    );
  }
}

class AttachmentChip extends StatelessWidget {
  const AttachmentChip(this.icon, this.label,
      {required this.onPressed, this.enabled = true, super.key});

  final IconData icon;
  final String label;
  final VoidCallback onPressed;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: "Attach $label evidence",
      child: OutlinedButton.icon(
        onPressed: enabled ? onPressed : null,
        icon: Icon(icon),
        label: Text(label),
      ),
    );
  }
}
