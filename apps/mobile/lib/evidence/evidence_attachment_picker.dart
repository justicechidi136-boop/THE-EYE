import "dart:async";
import "dart:io";

import "package:flutter/material.dart";
import "package:permission_handler/permission_handler.dart";
import "package:url_launcher/url_launcher.dart";

import "../contracts/the_eye_enums.dart";
import "evidence_audio_preview.dart";
import "evidence_capture_controller.dart";
import "evidence_capture_service.dart";
import "evidence_media_source.dart";
import "evidence_policy.dart";
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
    this.policy = EvidencePolicy.incident,
    this.figmaStyle = false,
    this.onAttachmentsChanged,
    super.key,
  });

  final bool lowDataMode;
  final EvidencePolicy policy;
  final bool figmaStyle;
  final ValueChanged<int>? onAttachmentsChanged;

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
  void clearAttachments() {
    final controller = _controller;
    if (controller == null || controller.attachments.isEmpty) return;
    for (final attachment
        in List<LocalEvidenceAttachment>.from(controller.attachments)) {
      controller.remove(attachment.localId);
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    _controller ??= createEvidenceCaptureController(context,
        lowDataMode: widget.lowDataMode, policy: widget.policy);
    final picker = EvidenceAttachmentPicker(
      controller: _controller!,
      lowDataMode: widget.lowDataMode,
      figmaStyle: widget.figmaStyle,
      onAttachmentsChanged: widget.onAttachmentsChanged,
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
            "Upload evidence (photo, video, audio)",
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
  EvidencePolicy policy = EvidencePolicy.incident,
  double? latitude,
  double? longitude,
}) {
  return EvidenceCaptureController(
    captureService: EvidenceCaptureService(),
    mediaSource: ImagePickerEvidenceSource(),
    permissionService: EvidencePermissionService(),
    policy: policy,
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

class EvidenceAttachmentPicker extends StatefulWidget {
  const EvidenceAttachmentPicker({
    required this.controller,
    required this.lowDataMode,
    this.figmaStyle = false,
    this.onAttachmentsChanged,
    super.key,
  });

  final EvidenceCaptureController controller;
  final bool lowDataMode;
  final bool figmaStyle;
  final ValueChanged<int>? onAttachmentsChanged;

  @override
  State<EvidenceAttachmentPicker> createState() =>
      _EvidenceAttachmentPickerState();
}

class _EvidenceAttachmentPickerState extends State<EvidenceAttachmentPicker> {
  final EvidenceAudioPreviewPlayer _audioPreview = EvidenceAudioPreviewPlayer();

  @override
  void dispose() {
    unawaited(_audioPreview.dispose());
    super.dispose();
  }

  EvidenceCaptureController get controller => widget.controller;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        controller.lowDataMode = widget.lowDataMode;
        widget.onAttachmentsChanged?.call(controller.attachments.length);
        final voiceReportAttachments = controller.attachments
            .where(
              (attachment) =>
                  attachment.isAudio &&
                  attachment.metadata["voiceReport"] == true,
            )
            .toList(growable: false);
        final listAttachments = controller.attachments
            .where(
              (attachment) => !(attachment.isAudio &&
                  attachment.metadata["voiceReport"] == true),
            )
            .toList(growable: false);
        final voiceUploadProgress = voiceReportAttachments.isEmpty
            ? null
            : voiceReportAttachments.first.uploadProgress;
        final photoCount = controller.policy
            .countForMediaType(listAttachments, IncidentMediaType.image);
        final videoCount = controller.policy
            .countForMediaType(listAttachments, IncidentMediaType.video);
        final audioCount = controller.policy.countForMediaType(
              listAttachments.where(
                (item) => item.metadata["voiceReport"] != true,
              ),
              IncidentMediaType.audio,
            ) +
            voiceReportAttachments.length;
        final filesCount =
            listAttachments.length + voiceReportAttachments.length;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const VoiceConsentBanner(),
            const SizedBox(height: 12),
            VoiceRecorder(
              enabled: !controller.busy &&
                  (controller.canAddMore || voiceReportAttachments.isNotEmpty),
              uploadProgress: voiceUploadProgress,
              onRecordingReady: (result) {
                for (final existing in voiceReportAttachments) {
                  controller.remove(existing.localId);
                }
                controller.addVoiceAttachment(result.attachment);
              },
              onRecordingRemoved: () {
                for (final existing in [
                  ...controller.attachments.where(
                    (attachment) =>
                        attachment.isAudio &&
                        attachment.metadata["voiceReport"] == true,
                  ),
                ]) {
                  controller.remove(existing.localId);
                }
              },
            ),
            if (widget.figmaStyle) ...[
              Material(
                color: EyeSemanticColors.of(context).elevatedSurface,
                borderRadius: BorderRadius.circular(8),
                child: InkWell(
                  onTap: controller.busy || !controller.canAddMore
                      ? null
                      : () => _showEvidenceActions(context),
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
                          "Tap to add evidence",
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
              Wrap(
                spacing: 10,
                runSpacing: 4,
                children: [
                  _CapacityChip(
                    label: controller.policy.capacityLabel(
                      mediaType: IncidentMediaType.image,
                      usedCount: photoCount,
                    ),
                  ),
                  _CapacityChip(
                    label: controller.policy.capacityLabel(
                      mediaType: IncidentMediaType.video,
                      usedCount: videoCount,
                    ),
                  ),
                  _CapacityChip(
                    label: controller.policy.capacityLabel(
                      mediaType: IncidentMediaType.audio,
                      usedCount: audioCount,
                    ),
                  ),
                  _CapacityChip(
                    label: controller.policy.filesCapacityLabel(filesCount),
                  ),
                ],
              ),
              const SizedBox(height: 10),
            ] else
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  AttachmentChip(
                    Icons.photo_camera,
                    "Photo",
                    enabled: !controller.busy &&
                        controller.canAddMoreFor(IncidentMediaType.image),
                    onPressed: () => _showPhotoActions(context),
                  ),
                  AttachmentChip(
                    Icons.videocam,
                    "Video",
                    enabled: !controller.busy &&
                        controller.canAddMoreFor(IncidentMediaType.video),
                    onPressed: () => _showVideoActions(context),
                  ),
                  AttachmentChip(
                    Icons.mic,
                    "Audio",
                    enabled: !controller.busy &&
                        controller.canAddMoreFor(IncidentMediaType.audio),
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
            if (widget.lowDataMode)
              const Padding(
                padding: EdgeInsets.only(top: 12),
                child: Text("Low-data mode will compress media before upload."),
              ),
            if (listAttachments.isNotEmpty) ...[
              const SizedBox(height: 14),
              ...() {
                final presentations =
                    EvidencePresentationMapper.mapLocalAttachments(
                  listAttachments,
                );
                return [
                  for (var i = 0; i < presentations.length; i++)
                    EyeEvidenceCard(
                      presentation: presentations[i],
                      uploadProgress: listAttachments[i].uploadProgress,
                      onPreviewTap: presentations[i].canView
                          ? () => _openAttachmentPreview(
                                context,
                                listAttachments[i],
                                presentations[i].displayName,
                              )
                          : null,
                      onPlay: presentations[i].canPlay
                          ? () => listAttachments[i].isAudio
                              ? _audioPreview.toggle(
                                  listAttachments[i].localId,
                                  listAttachments[i].uploadPath,
                                )
                              : _openAttachmentPreview(
                                  context,
                                  listAttachments[i],
                                  presentations[i].displayName,
                                )
                          : null,
                      onRemove: () =>
                          controller.remove(listAttachments[i].localId),
                      onRetry: presentations[i].canRetry
                          ? () => controller.retryFailedUpload(
                                listAttachments[i].localId,
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
                  controller.pickImages();
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
                  controller.pickVideos();
                }),
          ],
        ),
      ),
    );
  }

  Future<void> _showEvidenceActions(BuildContext context) async {
    await showModalBottomSheet<void>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              enabled: controller.canAddMoreFor(IncidentMediaType.image),
              leading: const Icon(Icons.photo_camera),
              title: const Text("Take photo"),
              onTap: () {
                Navigator.pop(context);
                controller.takePhoto();
              },
            ),
            ListTile(
              enabled: controller.canAddMoreFor(IncidentMediaType.image),
              leading: const Icon(Icons.photo_library),
              title: const Text("Choose image"),
              onTap: () {
                Navigator.pop(context);
                controller.pickImages();
              },
            ),
            ListTile(
              enabled: controller.canAddMoreFor(IncidentMediaType.video),
              leading: const Icon(Icons.videocam),
              title: const Text("Record video"),
              onTap: () {
                Navigator.pop(context);
                controller.recordVideo();
              },
            ),
            ListTile(
              enabled: controller.canAddMoreFor(IncidentMediaType.video),
              leading: const Icon(Icons.video_library),
              title: const Text("Choose video"),
              onTap: () {
                Navigator.pop(context);
                controller.pickVideos();
              },
            ),
            ListTile(
              enabled: controller.canAddMoreFor(IncidentMediaType.audio),
              leading: const Icon(Icons.mic),
              title: const Text("Choose audio"),
              onTap: () {
                Navigator.pop(context);
                controller.pickAudio();
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openAttachmentPreview(
    BuildContext context,
    LocalEvidenceAttachment attachment,
    String label,
  ) async {
    await showDialog<void>(
      context: context,
      builder: (context) {
        final duration = attachment.durationSeconds;
        return AlertDialog(
          title: Text(label),
          content: attachment.isImage &&
                  File(attachment.uploadPath).existsSync()
              ? ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Image.file(
                    File(attachment.uploadPath),
                    fit: BoxFit.cover,
                  ),
                )
              : attachment.isVideo && File(attachment.uploadPath).existsSync()
                  ? SizedBox(
                      width: 240,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.play_circle_fill, size: 54),
                          const SizedBox(height: 8),
                          const Text(
                            "Video ready to play",
                            textAlign: TextAlign.center,
                          ),
                          if (duration != null) ...[
                            const SizedBox(height: 6),
                            Text("Duration ${_clock(duration)}"),
                          ],
                          const SizedBox(height: 12),
                          FilledButton.icon(
                            onPressed: () =>
                                _launchVideo(attachment.uploadPath),
                            icon: const Icon(Icons.play_arrow),
                            label: const Text("Play video"),
                          ),
                        ],
                      ),
                    )
                  : SizedBox(
                      width: 220,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            attachment.isVideo
                                ? Icons.play_circle_fill
                                : Icons.graphic_eq,
                            size: 54,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            attachment.isVideo
                                ? "Video preview unavailable"
                                : "Audio attachment",
                            textAlign: TextAlign.center,
                          ),
                          if (duration != null) ...[
                            const SizedBox(height: 6),
                            Text("Duration ${_clock(duration)}"),
                          ],
                        ],
                      ),
                    ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text("Close"),
            ),
          ],
        );
      },
    );
  }

  String _clock(int seconds) {
    final m = (seconds ~/ 60).toString().padLeft(2, "0");
    final s = (seconds % 60).toString().padLeft(2, "0");
    return "$m:$s";
  }

  Future<void> _launchVideo(String path) async {
    final uri = Uri.file(path);
    await launchUrl(uri, mode: LaunchMode.externalApplication);
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

class _CapacityChip extends StatelessWidget {
  const _CapacityChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        color: EyeSemanticColors.of(context).elevatedSurface,
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          color: EyeSemanticColors.of(context).bodyText,
        ),
      ),
    );
  }
}
