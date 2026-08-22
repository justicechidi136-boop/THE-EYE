import "dart:typed_data";

import "package:flutter/material.dart";
import "package:video_thumbnail/video_thumbnail.dart";

import "../design_system/eye_semantic_colors.dart";
import "evidence_item.dart";

abstract class EvidenceVideoThumbnailProvider {
  const EvidenceVideoThumbnailProvider();

  Future<Uint8List?> load(EvidenceItem item);
}

class DeviceEvidenceVideoThumbnailProvider
    implements EvidenceVideoThumbnailProvider {
  const DeviceEvidenceVideoThumbnailProvider();

  @override
  Future<Uint8List?> load(EvidenceItem item) async {
    final uri = await item.resolveUri();
    return VideoThumbnail.thumbnailData(
      video: uri.isScheme("file") ? uri.toFilePath() : uri.toString(),
      imageFormat: ImageFormat.JPEG,
      maxWidth: 480,
      timeMs: 500,
      quality: 72,
    );
  }
}

class EvidenceVideoThumbnail extends StatefulWidget {
  const EvidenceVideoThumbnail({
    required this.item,
    this.provider = const DeviceEvidenceVideoThumbnailProvider(),
    super.key,
  });

  final EvidenceItem item;
  final EvidenceVideoThumbnailProvider provider;

  @override
  State<EvidenceVideoThumbnail> createState() => _EvidenceVideoThumbnailState();
}

class _EvidenceVideoThumbnailState extends State<EvidenceVideoThumbnail> {
  late Future<Uint8List?> _thumbnail;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant EvidenceVideoThumbnail oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.item.id != widget.item.id ||
        oldWidget.provider != widget.provider) {
      _load();
    }
  }

  void _load() {
    _thumbnail = widget.provider.load(widget.item);
  }

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    return FutureBuilder<Uint8List?>(
      future: _thumbnail,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return ColoredBox(
            color: colors.elevatedSurface,
            child: const Center(
              child: SizedBox.square(
                dimension: 22,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          );
        }
        final bytes = snapshot.data;
        if (snapshot.hasError || bytes == null || bytes.isEmpty) {
          return ColoredBox(
            key: const ValueKey("video-thumbnail-fallback"),
            color: colors.elevatedSurface,
            child: Center(
              child: Icon(
                Icons.videocam_outlined,
                color: colors.mutedText,
                size: 34,
              ),
            ),
          );
        }
        return Image.memory(
          bytes,
          key: const ValueKey("video-thumbnail-image"),
          fit: BoxFit.cover,
          gaplessPlayback: true,
        );
      },
    );
  }
}
