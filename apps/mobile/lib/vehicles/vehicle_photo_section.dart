import "dart:io";

import "package:flutter/material.dart";

import "../evidence/evidence_attachment_picker.dart";
import "../evidence/evidence_capture_controller.dart";
import "../evidence/evidence_policy.dart";
import "../evidence/local_evidence_attachment.dart";
import "../widgets/section_card.dart";

enum VehiclePhotoAngle {
  front("FRONT", "Front"),
  rear("REAR", "Rear"),
  side("SIDE", "Side"),
  other("OTHER", "Other");

  const VehiclePhotoAngle(this.apiValue, this.label);

  final String apiValue;
  final String label;

  static VehiclePhotoAngle fromApi(String? value) {
    return values.firstWhere(
      (angle) => angle.apiValue == value?.toUpperCase(),
      orElse: () => other,
    );
  }
}

Future<VehiclePhotoAngle?> chooseVehiclePhotoAngle(BuildContext context) {
  return showModalBottomSheet<VehiclePhotoAngle>(
    context: context,
    showDragHandle: true,
    builder: (context) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
            child: Text(
              "Select photo angle",
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
          for (final angle in VehiclePhotoAngle.values)
            ListTile(
              title: Text(angle.label),
              onTap: () => Navigator.of(context).pop(angle),
            ),
        ],
      ),
    ),
  );
}

Future<ImageSourceChoice?> chooseVehiclePhotoSource(BuildContext context) {
  return showModalBottomSheet<ImageSourceChoice>(
    context: context,
    showDragHandle: true,
    builder: (context) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            leading: const Icon(Icons.photo_camera_outlined),
            title: const Text("Camera"),
            onTap: () => Navigator.of(context).pop(ImageSourceChoice.camera),
          ),
          ListTile(
            leading: const Icon(Icons.photo_library_outlined),
            title: const Text("Gallery"),
            onTap: () => Navigator.of(context).pop(ImageSourceChoice.gallery),
          ),
        ],
      ),
    ),
  );
}

enum ImageSourceChoice { camera, gallery }

class VehiclePhotoSection extends StatefulWidget {
  const VehiclePhotoSection({
    required this.lowDataMode,
    this.title = "Vehicle Photos",
    this.controller,
    super.key,
  });

  final bool lowDataMode;
  final String title;
  final EvidenceCaptureController? controller;

  @override
  State<VehiclePhotoSection> createState() => VehiclePhotoSectionState();
}

class VehiclePhotoSectionState extends State<VehiclePhotoSection> {
  EvidenceCaptureController? _controller;

  List<LocalEvidenceAttachment> get attachments =>
      List<LocalEvidenceAttachment>.from(_controller?.attachments ?? const []);

  void clearAttachments() {
    final controller = _controller;
    if (controller == null) return;
    for (final item in List<LocalEvidenceAttachment>.from(
      controller.attachments,
    )) {
      controller.remove(item.localId);
    }
  }

  Future<void> _addPhoto() async {
    final controller = _controller!;
    if (!controller.canAddMore) return;
    final angle = await chooseVehiclePhotoAngle(context);
    if (angle == null || !mounted) return;
    final source = await chooseVehiclePhotoSource(context);
    if (source == null || !mounted) return;

    final existingIds = controller.attachments
        .map((attachment) => attachment.localId)
        .toSet();
    if (source == ImageSourceChoice.camera) {
      await controller.takePhoto();
    } else {
      await controller.pickImages();
    }
    for (var index = 0; index < controller.attachments.length; index++) {
      final attachment = controller.attachments[index];
      if (existingIds.contains(attachment.localId)) continue;
      controller.attachments[index] = attachment.copyWith(
        metadata: {
          ...attachment.metadata,
          "vehiclePhotoAngle": angle.apiValue,
        },
      );
    }
    if (mounted) setState(() {});
  }

  Future<void> _preview(LocalEvidenceAttachment photo) {
    return showDialog<void>(
      context: context,
      builder: (context) => Dialog(
        child: InteractiveViewer(
          child: Image.file(File(photo.originalPath), fit: BoxFit.contain),
        ),
      ),
    );
  }

  @override
  void dispose() {
    if (widget.controller == null) _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller ??= widget.controller ??
        createEvidenceCaptureController(
          context,
          lowDataMode: widget.lowDataMode,
          policy: EvidencePolicy.vehiclePhotos,
        );
    return SectionCard(
      title: widget.title,
      child: AnimatedBuilder(
        animation: controller,
        builder: (context, _) {
          final photos = controller.attachments;
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text("Add clear reference photos for each vehicle angle."),
              const SizedBox(height: 12),
              if (photos.isNotEmpty)
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: photos.length,
                  gridDelegate:
                      const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                    mainAxisSpacing: 8,
                    crossAxisSpacing: 8,
                  ),
                  itemBuilder: (context, index) {
                    final photo = photos[index];
                    final angle = VehiclePhotoAngle.fromApi(
                      photo.metadata["vehiclePhotoAngle"] as String?,
                    );
                    return Stack(
                      fit: StackFit.expand,
                      children: [
                        Material(
                          clipBehavior: Clip.antiAlias,
                          borderRadius: BorderRadius.circular(8),
                          child: Ink.image(
                            image: FileImage(File(photo.originalPath)),
                            fit: BoxFit.cover,
                            child: InkWell(onTap: () => _preview(photo)),
                          ),
                        ),
                        Positioned(
                          left: 4,
                          bottom: 4,
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              color: Colors.black87,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 3,
                              ),
                              child: Text(
                                angle.label,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 11,
                                ),
                              ),
                            ),
                          ),
                        ),
                        Positioned(
                          right: 0,
                          top: 0,
                          child: IconButton.filledTonal(
                            tooltip: "Remove ${angle.label.toLowerCase()} photo",
                            onPressed: controller.busy
                                ? null
                                : () => controller.remove(photo.localId),
                            icon: const Icon(Icons.close, size: 16),
                          ),
                        ),
                      ],
                    );
                  },
                ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Text(
                    "${photos.length}/${EvidencePolicy.vehiclePhotos.maxPhotos}",
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const Spacer(),
                  FilledButton.icon(
                    onPressed: controller.busy || !controller.canAddMore
                        ? null
                        : _addPhoto,
                    icon: const Icon(Icons.add_a_photo_outlined),
                    label: const Text("Add photo"),
                  ),
                ],
              ),
              if (controller.busy) ...[
                const SizedBox(height: 8),
                const LinearProgressIndicator(),
              ],
              if (controller.lastError != null) ...[
                const SizedBox(height: 8),
                Text(
                  controller.lastError!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}
