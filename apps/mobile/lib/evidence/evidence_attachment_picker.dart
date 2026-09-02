import "dart:async";
import "dart:io";

import "package:flutter/material.dart";
import "package:permission_handler/permission_handler.dart";

import "../contracts/the_eye_enums.dart";
import "evidence_audio_preview.dart";
import "evidence_capture_controller.dart";
import "evidence_capture_service.dart";
import "evidence_item.dart";
import "evidence_media_source.dart";
import "evidence_policy.dart";
import "evidence_permission_service.dart";
import "evidence_video_thumbnail.dart";
import "evidence_viewer_screen.dart";
import "local_evidence_attachment.dart";
import "../design_system/eye_semantic_colors.dart";
import "../presentation/evidence_presentation.dart";
import "../voice/voice_consent_banner.dart";
import "../voice/voice_recorder.dart";
import "../widgets/section_card.dart";

class ManagedEvidenceSection extends StatefulWidget {
  const ManagedEvidenceSection({
    required this.lowDataMode,
    this.policy = EvidencePolicy.incident,
    this.title = "Evidence",
    this.description,
    this.figmaStyle = false,
    this.primaryIdentificationStyle = false,
    this.onAttachmentsChanged,
    super.key,
  });

  final bool lowDataMode;
  final EvidencePolicy policy;
  final String title;
  final String? description;
  final bool figmaStyle;
  final bool primaryIdentificationStyle;
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
    for (final attachment in List<LocalEvidenceAttachment>.from(
      controller.attachments,
    )) {
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
    _controller ??= createEvidenceCaptureController(
      context,
      lowDataMode: widget.lowDataMode,
      policy: widget.policy,
    );
    if (widget.primaryIdentificationStyle) {
      return _PrimaryIdentificationPhotoPicker(controller: _controller!);
    }
    return SectionCard(
      title: widget.title,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (widget.description != null) ...[
            Text(
              widget.description!,
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 12),
          ],
          EvidenceAttachmentPicker(
            controller: _controller!,
            lowDataMode: widget.lowDataMode,
            onAttachmentsChanged: widget.onAttachmentsChanged,
          ),
        ],
      ),
    );
  }
}

class _PrimaryIdentificationPhotoPicker extends StatelessWidget {
  const _PrimaryIdentificationPhotoPicker({required this.controller});

  final EvidenceCaptureController controller;

  Future<void> _showSourceSheet(BuildContext context) async {
    await showModalBottomSheet<void>(
      context: context,
      useSafeArea: true,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 38,
                  height: 4,
                  decoration: BoxDecoration(
                    color: EyeSemanticColors.of(sheetContext).border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Text(
                "Add photo",
                style: Theme.of(sheetContext).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _PrimaryPhotoSourceAction(
                      icon: Icons.photo_camera_outlined,
                      label: "Camera",
                      onTap: () {
                        Navigator.pop(sheetContext);
                        controller.takePhoto();
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _PrimaryPhotoSourceAction(
                      icon: Icons.photo_library_outlined,
                      label: "Gallery",
                      onTap: () {
                        Navigator.pop(sheetContext);
                        controller.pickImages();
                      },
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _openViewer(
    BuildContext context,
    LocalEvidenceAttachment attachment,
  ) async {
    final action = await Navigator.of(context).push<_PrimaryPhotoAction>(
      MaterialPageRoute<_PrimaryPhotoAction>(
        settings: const RouteSettings(name: "/missing-person/photo"),
        builder: (context) => _PrimaryIdentificationPhotoViewer(
          attachment: attachment,
        ),
      ),
    );
    if (!context.mounted) return;
    if (action == _PrimaryPhotoAction.remove) {
      controller.remove(attachment.localId);
    } else if (action == _PrimaryPhotoAction.replace) {
      controller.remove(attachment.localId);
      await _showSourceSheet(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        final colors = EyeSemanticColors.of(context);
        final attachment =
            controller.attachments.where((item) => item.isImage).firstOrNull;
        return Column(
          key: const Key("missing-person-primary-photo-section"),
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              "A clear, recent photo is the most important detail for identification.",
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: colors.mutedText,
                    height: 1.5,
                  ),
            ),
            const SizedBox(height: 12),
            Semantics(
              button: true,
              label: attachment == null
                  ? "Add recent missing person photo"
                  : "Open missing person photo",
              child: Material(
                color: colors.elevatedSurface,
                borderRadius: BorderRadius.circular(16),
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: controller.busy
                      ? null
                      : attachment == null
                          ? () => _showSourceSheet(context)
                          : () => _openViewer(context, attachment),
                  child: AspectRatio(
                    aspectRatio: 249 / 220,
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        if (attachment != null)
                          if (File(attachment.uploadPath).existsSync())
                            Image.file(
                              File(attachment.uploadPath),
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => Center(
                                child: Icon(
                                  Icons.broken_image_outlined,
                                  color: colors.mutedText,
                                  size: 42,
                                ),
                              ),
                            )
                          else
                            Center(
                              child: Icon(
                                Icons.broken_image_outlined,
                                color: colors.mutedText,
                                size: 42,
                              ),
                            )
                        else
                          CustomPaint(
                            painter: _DashedBorderPainter(color: colors.border),
                            child: Center(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Container(
                                    width: 52,
                                    height: 52,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: colors.accentText.withValues(
                                        alpha: 0.12,
                                      ),
                                    ),
                                    child: Icon(
                                      Icons.person_outline_rounded,
                                      color: colors.accentText,
                                      size: 28,
                                    ),
                                  ),
                                  const SizedBox(height: 12),
                                  const Text(
                                    "Add recent photo",
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    "Clear face, good lighting",
                                    style: Theme.of(context)
                                        .textTheme
                                        .bodySmall
                                        ?.copyWith(color: colors.mutedText),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        if (attachment != null) ...[
                          Positioned(
                            left: 10,
                            top: 10,
                            child: _PhotoOverlayLabel(label: "ID PHOTO"),
                          ),
                          Positioned(
                            right: 10,
                            bottom: 10,
                            child: _PhotoOverlayLabel(
                              label: "Replace",
                              icon: Icons.refresh_rounded,
                            ),
                          ),
                        ],
                        if (controller.busy)
                          ColoredBox(
                            color: Colors.black.withValues(alpha: 0.45),
                            child: const Center(
                              child: CircularProgressIndicator(),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            if (controller.lastError != null) ...[
              const SizedBox(height: 8),
              Text(
                controller.lastError!,
                key: const Key("missing-person-primary-photo-error"),
                style: TextStyle(
                  color: colors.errorText,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ],
        );
      },
    );
  }
}

class _PrimaryPhotoSourceAction extends StatelessWidget {
  const _PrimaryPhotoSourceAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    return Material(
      color: colors.elevatedSurface,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: SizedBox(
          height: 96,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: colors.accentText, size: 28),
              const SizedBox(height: 8),
              Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
            ],
          ),
        ),
      ),
    );
  }
}

class _PhotoOverlayLabel extends StatelessWidget {
  const _PhotoOverlayLabel({required this.label, this.icon});

  final String label;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.68),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 14, color: Colors.white),
              const SizedBox(width: 4),
            ],
            Text(
              label,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 11,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

enum _PrimaryPhotoAction { replace, remove }

class _PrimaryIdentificationPhotoViewer extends StatelessWidget {
  const _PrimaryIdentificationPhotoViewer({required this.attachment});

  final LocalEvidenceAttachment attachment;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: const Text("Missing person photo"),
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            Expanded(
              child: Center(
                child: InteractiveViewer(
                  child: File(attachment.uploadPath).existsSync()
                      ? Image.file(File(attachment.uploadPath))
                      : const Icon(
                          Icons.broken_image_outlined,
                          color: Colors.white70,
                          size: 56,
                        ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => Navigator.of(context).pop(
                        _PrimaryPhotoAction.replace,
                      ),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        side: const BorderSide(color: Colors.white54),
                      ),
                      icon: const Icon(Icons.refresh_rounded),
                      label: const Text("Replace"),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => Navigator.of(context).pop(
                        _PrimaryPhotoAction.remove,
                      ),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.redAccent,
                        side: const BorderSide(color: Colors.redAccent),
                      ),
                      icon: const Icon(Icons.delete_outline),
                      label: const Text("Remove"),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DashedBorderPainter extends CustomPainter {
  const _DashedBorderPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..addRRect(
        RRect.fromRectAndRadius(
          Offset.zero & size,
          const Radius.circular(16),
        ),
      );
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    for (final metric in path.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        canvas.drawPath(
          metric.extractPath(distance, distance + 7),
          paint,
        );
        distance += 12;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedBorderPainter oldDelegate) =>
      oldDelegate.color != color;
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
            child: const Text("Not now"),
          ),
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
            child: const Text("Continue"),
          ),
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
    this.onAttachmentsChanged,
    super.key,
  });

  final EvidenceCaptureController controller;
  final bool lowDataMode;
  final ValueChanged<int>? onAttachmentsChanged;

  @override
  State<EvidenceAttachmentPicker> createState() =>
      _EvidenceAttachmentPickerState();
}

class _EvidenceAttachmentPickerState extends State<EvidenceAttachmentPicker> {
  final EvidenceAudioPreviewPlayer _audioPreview = EvidenceAudioPreviewPlayer();
  int? _lastReportedAttachmentCount;

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
        _reportAttachmentCount(controller.attachments.length);
        final attachments = controller.attachments.toList(growable: false);
        final presentations = EvidencePresentationMapper.mapLocalAttachments(
          attachments,
        );
        final photoCount = controller.policy.countForMediaType(
          attachments,
          IncidentMediaType.image,
        );
        final videoCount = controller.policy.countForMediaType(
          attachments,
          IncidentMediaType.video,
        );
        final audioCount = controller.policy.countForMediaType(
          attachments,
          IncidentMediaType.audio,
        );
        final visualIndexes = <int>[
          for (var i = 0; i < attachments.length; i++)
            if (attachments[i].isImage || attachments[i].isVideo) i,
        ];
        final audioIndexes = <int>[
          for (var i = 0; i < attachments.length; i++)
            if (attachments[i].isAudio) i,
        ];
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const VoiceConsentBanner(),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (controller.policy.maxPhotos > 0)
                  _CapacityChip(
                    label: "Photos $photoCount/${controller.policy.maxPhotos}",
                  ),
                if (controller.policy.maxVideos > 0)
                  _CapacityChip(
                    label: "Videos $videoCount/${controller.policy.maxVideos}",
                  ),
                if (controller.policy.maxAudio > 0)
                  _CapacityChip(
                    label: "Audio $audioCount/${controller.policy.maxAudio}",
                  ),
              ],
            ),
            if (controller.busy) ...[
              const SizedBox(height: 12),
              const LinearProgressIndicator(),
              const SizedBox(height: 8),
              const Text(
                "Preparing evidence...",
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
            ],
            if (controller.lastError != null) ...[
              const SizedBox(height: 12),
              Semantics(
                liveRegion: true,
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: EyeSemanticColors.of(
                      context,
                    ).error.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: EyeSemanticColors.of(
                        context,
                      ).error.withValues(alpha: 0.35),
                    ),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        Icons.error_outline,
                        color: EyeSemanticColors.of(context).error,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          controller.lastError!,
                          style: TextStyle(
                            color: EyeSemanticColors.of(context).errorText,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
            if (visualIndexes.isNotEmpty) ...[
              const SizedBox(height: 14),
              LayoutBuilder(
                builder: (context, constraints) {
                  final tileWidth = (constraints.maxWidth - 20) / 3;
                  return Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      for (final index in visualIndexes)
                        _VisualAttachmentTile(
                          width: tileWidth,
                          attachment: attachments[index],
                          presentation: presentations[index],
                          onPreview: () => _openAttachmentPreview(
                            context,
                            attachments[index],
                            presentations[index].displayName,
                          ),
                          onRemove: () =>
                              controller.remove(attachments[index].localId),
                          onRetry: presentations[index].canRetry
                              ? () => controller.retryFailedUpload(
                                    attachments[index].localId,
                                  )
                              : null,
                        ),
                    ],
                  );
                },
              ),
            ],
            if (audioIndexes.isNotEmpty) ...[
              const SizedBox(height: 12),
              for (final index in audioIndexes) ...[
                _AudioAttachmentRow(
                  attachment: attachments[index],
                  presentation: presentations[index],
                  isPlaying: _audioPreview.isPlaying(
                    attachments[index].localId,
                  ),
                  onPlay: () => _toggleAudio(attachments[index]),
                  onRemove: () => controller.remove(attachments[index].localId),
                  onRetry: presentations[index].canRetry
                      ? () => controller.retryFailedUpload(
                            attachments[index].localId,
                          )
                      : null,
                ),
                if (index != audioIndexes.last) const SizedBox(height: 8),
              ],
            ],
            const SizedBox(height: 12),
            Semantics(
              button: true,
              label: attachments.isEmpty
                  ? "Add photo, video, or audio evidence"
                  : "Add more photo, video, or audio evidence",
              child: OutlinedButton.icon(
                onPressed: controller.busy || !controller.canAddMore
                    ? null
                    : () => _showEvidenceActions(context),
                icon: const Icon(Icons.add),
                label: Text(
                  attachments.isEmpty ? "Add evidence" : "Add more evidence",
                ),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                  side: BorderSide(color: EyeSemanticColors.of(context).border),
                ),
              ),
            ),
            if (widget.lowDataMode) ...[
              const SizedBox(height: 10),
              const Text("Low-data mode will compress media before upload."),
            ],
          ],
        );
      },
    );
  }

  void _reportAttachmentCount(int count) {
    if (widget.onAttachmentsChanged == null ||
        _lastReportedAttachmentCount == count) {
      return;
    }
    _lastReportedAttachmentCount = count;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _lastReportedAttachmentCount != count) return;
      widget.onAttachmentsChanged?.call(count);
    });
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
              },
            ),
            ListTile(
              leading: const Icon(Icons.video_library),
              title: const Text("Choose video"),
              onTap: () {
                Navigator.pop(context);
                controller.pickVideos();
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showEvidenceActions(BuildContext context) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (sheetContext) => _EvidenceActionSheet(
        controller: controller,
        onCamera: () {
          Navigator.pop(sheetContext);
          controller.takePhoto();
        },
        onVideo: () {
          Navigator.pop(sheetContext);
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) _showVideoActions(this.context);
          });
        },
        onGallery: () {
          Navigator.pop(sheetContext);
          controller.pickImages();
        },
        onAudioFile: () {
          Navigator.pop(sheetContext);
          controller.pickAudio();
        },
      ),
    );
  }

  Future<void> _toggleAudio(LocalEvidenceAttachment attachment) async {
    final wasPlaying = _audioPreview.isPlaying(attachment.localId);
    final playback = _audioPreview.toggle(
      attachment.localId,
      attachment.uploadPath,
    );
    if (wasPlaying) {
      await playback;
      if (mounted) setState(() {});
      return;
    }

    try {
      await _audioPreview.playingStream
          .firstWhere((playing) => playing)
          .timeout(const Duration(seconds: 2));
    } on TimeoutException {
      // The player will surface its own platform failure if playback cannot start.
    }
    if (mounted) setState(() {});
    unawaited(
      playback.whenComplete(() {
        if (mounted) setState(() {});
      }),
    );
  }

  Future<void> _openAttachmentPreview(
    BuildContext context,
    LocalEvidenceAttachment attachment,
    String label,
  ) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        settings: RouteSettings(name: "/evidence/${attachment.localId}"),
        builder: (_) => EvidenceViewerScreen(
          item: EvidenceItem.fromLocal(attachment, label: label),
        ),
      ),
    );
  }
}

class _EvidenceActionSheet extends StatefulWidget {
  const _EvidenceActionSheet({
    required this.controller,
    required this.onCamera,
    required this.onVideo,
    required this.onGallery,
    required this.onAudioFile,
  });

  final EvidenceCaptureController controller;
  final VoidCallback onCamera;
  final VoidCallback onVideo;
  final VoidCallback onGallery;
  final VoidCallback onAudioFile;

  @override
  State<_EvidenceActionSheet> createState() => _EvidenceActionSheetState();
}

class _EvidenceActionSheetState extends State<_EvidenceActionSheet> {
  bool _showRecorder = false;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.controller,
      builder: (context, _) {
        final controller = widget.controller;
        final colors = EyeSemanticColors.of(context);
        final voiceAttachments = controller.attachments
            .where(
              (item) => item.isAudio && item.metadata["voiceReport"] == true,
            )
            .toList(growable: false);
        final photoCount = controller.policy.countForMediaType(
          controller.attachments,
          IncidentMediaType.image,
        );
        final videoCount = controller.policy.countForMediaType(
          controller.attachments,
          IncidentMediaType.video,
        );
        final audioCount = controller.policy.countForMediaType(
          controller.attachments,
          IncidentMediaType.audio,
        );
        return Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 8,
            bottom: 16 + MediaQuery.viewInsetsOf(context).bottom,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 38,
                    height: 4,
                    decoration: BoxDecoration(
                      color: colors.border,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        "Add evidence",
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                    ),
                    IconButton(
                      tooltip: "Close add evidence",
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                LayoutBuilder(
                  builder: (context, constraints) {
                    final tileWidth = (constraints.maxWidth - 20) / 3;
                    return Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: [
                        if (controller.policy.maxPhotos > 0) ...[
                          _EvidenceActionTile(
                            width: tileWidth,
                            icon: Icons.photo_camera_outlined,
                            label: "Camera",
                            enabled: !controller.busy &&
                                controller.canAddMoreFor(
                                  IncidentMediaType.image,
                                ),
                            onTap: widget.onCamera,
                          ),
                          _EvidenceActionTile(
                            width: tileWidth,
                            icon: Icons.photo_library_outlined,
                            label: "Gallery",
                            enabled: !controller.busy &&
                                controller.canAddMoreFor(
                                  IncidentMediaType.image,
                                ),
                            onTap: widget.onGallery,
                          ),
                        ],
                        if (controller.policy.maxVideos > 0)
                          _EvidenceActionTile(
                            width: tileWidth,
                            icon: Icons.videocam_outlined,
                            label: "Video",
                            enabled: !controller.busy &&
                                controller.canAddMoreFor(
                                  IncidentMediaType.video,
                                ),
                            onTap: widget.onVideo,
                          ),
                        if (controller.policy.maxAudio > 0) ...[
                          _EvidenceActionTile(
                            width: tileWidth,
                            icon: Icons.mic_none_outlined,
                            label: "Record voice",
                            enabled: !controller.busy &&
                                (controller.canAddMoreFor(
                                      IncidentMediaType.audio,
                                    ) ||
                                    voiceAttachments.isNotEmpty),
                            onTap: () => setState(() => _showRecorder = true),
                          ),
                          _EvidenceActionTile(
                            width: tileWidth,
                            icon: Icons.audio_file_outlined,
                            label: "Choose audio file",
                            enabled: !controller.busy &&
                                controller.canAddMoreFor(
                                  IncidentMediaType.audio,
                                ),
                            onTap: widget.onAudioFile,
                          ),
                        ],
                      ],
                    );
                  },
                ),
                if (_showRecorder) ...[
                  const SizedBox(height: 14),
                  VoiceRecorder(
                    enabled: !controller.busy &&
                        (controller.canAddMoreFor(IncidentMediaType.audio) ||
                            voiceAttachments.isNotEmpty),
                    uploadProgress: voiceAttachments.isEmpty
                        ? null
                        : voiceAttachments.first.uploadProgress,
                    onRecordingReady: (result) {
                      for (final existing in voiceAttachments) {
                        controller.remove(existing.localId);
                      }
                      controller.addVoiceAttachment(result.attachment);
                      Navigator.of(context).pop();
                    },
                    onRecordingRemoved: () {
                      for (final existing in [
                        ...controller.attachments.where(
                          (item) =>
                              item.isAudio &&
                              item.metadata["voiceReport"] == true,
                        ),
                      ]) {
                        controller.remove(existing.localId);
                      }
                    },
                  ),
                ],
                const SizedBox(height: 14),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    if (controller.policy.maxPhotos > 0)
                      _CapacityChip(
                        label:
                            "Photos $photoCount/${controller.policy.maxPhotos}",
                      ),
                    if (controller.policy.maxVideos > 0)
                      _CapacityChip(
                        label:
                            "Videos $videoCount/${controller.policy.maxVideos}",
                      ),
                    if (controller.policy.maxAudio > 0)
                      _CapacityChip(
                        label:
                            "Audio $audioCount/${controller.policy.maxAudio}",
                      ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _EvidenceActionTile extends StatelessWidget {
  const _EvidenceActionTile({
    required this.width,
    required this.icon,
    required this.label,
    required this.enabled,
    required this.onTap,
  });

  final double width;
  final IconData icon;
  final String label;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    final foreground = enabled ? colors.bodyText : colors.disabledText;
    return Semantics(
      button: true,
      enabled: enabled,
      label: label,
      child: Material(
        color: colors.elevatedSurface,
        borderRadius: BorderRadius.circular(8),
        child: InkWell(
          onTap: enabled ? onTap : null,
          borderRadius: BorderRadius.circular(8),
          child: SizedBox(
            width: width,
            height: 88,
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    icon,
                    color: enabled ? colors.interactiveText : foreground,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    label,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: foreground,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _VisualAttachmentTile extends StatelessWidget {
  const _VisualAttachmentTile({
    required this.width,
    required this.attachment,
    required this.presentation,
    required this.onPreview,
    required this.onRemove,
    this.onRetry,
  });

  final double width;
  final LocalEvidenceAttachment attachment;
  final EvidencePresentation presentation;
  final VoidCallback onPreview;
  final VoidCallback onRemove;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    return Semantics(
      button: true,
      label: "Open ${presentation.semanticsLabel}",
      child: SizedBox(
        width: width,
        height: width,
        child: Material(
          color: colors.elevatedSurface,
          borderRadius: BorderRadius.circular(8),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onPreview,
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (attachment.isImage &&
                    File(attachment.uploadPath).existsSync())
                  Image.file(
                    File(attachment.uploadPath),
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const Center(
                      child: Icon(Icons.broken_image_outlined, size: 34),
                    ),
                  )
                else if (attachment.isVideo)
                  EvidenceVideoThumbnail(
                    item: EvidenceItem.fromLocal(
                      attachment,
                      label: presentation.displayName,
                    ),
                  )
                else
                  Center(
                    child: Icon(
                      attachment.isVideo
                          ? Icons.play_circle_fill
                          : Icons.image_outlined,
                      size: 42,
                      color: colors.secondaryText,
                    ),
                  ),
                Align(
                  alignment: Alignment.topLeft,
                  child: Padding(
                    padding: const EdgeInsets.all(6),
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.65),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 5,
                          vertical: 2,
                        ),
                        child: Text(
                          attachment.isVideo ? "Video" : "Photo",
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                if (attachment.isVideo && attachment.durationSeconds != null)
                  Align(
                    alignment: Alignment.bottomRight,
                    child: Padding(
                      padding: const EdgeInsets.all(6),
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.65),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 5,
                            vertical: 2,
                          ),
                          child: Text(
                            _evidenceClock(attachment.durationSeconds!),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                Align(
                  alignment: Alignment.topRight,
                  child: IconButton(
                    tooltip: "Remove ${presentation.displayName}",
                    onPressed: onRemove,
                    style: IconButton.styleFrom(
                      backgroundColor: Colors.black.withValues(alpha: 0.65),
                      foregroundColor: Colors.white,
                      minimumSize: const Size(40, 40),
                    ),
                    icon: const Icon(Icons.close, size: 18),
                  ),
                ),
                if (presentation.state == EvidenceDisplayState.uploading)
                  Align(
                    alignment: Alignment.bottomCenter,
                    child: LinearProgressIndicator(
                      value: attachment.uploadProgress,
                    ),
                  ),
                if (onRetry != null)
                  Align(
                    alignment: Alignment.bottomLeft,
                    child: IconButton(
                      tooltip: "Retry ${presentation.displayName}",
                      onPressed: onRetry,
                      style: IconButton.styleFrom(
                        backgroundColor: colors.error,
                        foregroundColor: Colors.white,
                        minimumSize: const Size(40, 40),
                      ),
                      icon: const Icon(Icons.replay, size: 18),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _AudioAttachmentRow extends StatelessWidget {
  const _AudioAttachmentRow({
    required this.attachment,
    required this.presentation,
    required this.isPlaying,
    required this.onPlay,
    required this.onRemove,
    this.onRetry,
  });

  final LocalEvidenceAttachment attachment;
  final EvidencePresentation presentation;
  final bool isPlaying;
  final VoidCallback onPlay;
  final VoidCallback onRemove;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    final isVoiceNote = attachment.metadata["voiceReport"] == true;
    return Semantics(
      container: true,
      label: presentation.semanticsLabel,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        decoration: BoxDecoration(
          color: colors.elevatedSurface,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: presentation.state == EvidenceDisplayState.failed
                ? colors.error
                : colors.border,
          ),
        ),
        child: Column(
          children: [
            Row(
              children: [
                IconButton.filled(
                  tooltip: isPlaying ? "Pause audio" : "Play audio",
                  onPressed: onPlay,
                  style: IconButton.styleFrom(
                    backgroundColor: colors.primaryAction,
                    foregroundColor: colors.primaryActionForeground,
                    minimumSize: const Size(44, 44),
                  ),
                  icon: Icon(isPlaying ? Icons.pause : Icons.play_arrow),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isVoiceNote ? "Voice note" : presentation.displayName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 3),
                      Row(
                        children: [
                          Expanded(
                            child: Container(
                              height: 4,
                              decoration: BoxDecoration(
                                color: colors.border,
                                borderRadius: BorderRadius.circular(2),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            attachment.durationSeconds == null
                                ? "--:--"
                                : _evidenceClock(attachment.durationSeconds!),
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                      if (presentation.state == EvidenceDisplayState.failed)
                        Text(
                          "Upload failed",
                          style: TextStyle(
                            color: colors.errorText,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                    ],
                  ),
                ),
                if (onRetry != null)
                  IconButton(
                    tooltip: "Retry ${presentation.displayName}",
                    onPressed: onRetry,
                    icon: const Icon(Icons.replay),
                  ),
                IconButton(
                  tooltip: "Remove ${presentation.displayName}",
                  onPressed: onRemove,
                  icon: Icon(Icons.delete_outline, color: colors.error),
                ),
              ],
            ),
            if (presentation.state == EvidenceDisplayState.uploading)
              LinearProgressIndicator(value: attachment.uploadProgress),
          ],
        ),
      ),
    );
  }
}

String _evidenceClock(int seconds) {
  final minutes = (seconds ~/ 60).toString().padLeft(2, "0");
  final remainder = (seconds % 60).toString().padLeft(2, "0");
  return "$minutes:$remainder";
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
