import "dart:io";

import "package:flutter/material.dart";

import "../../presentation/evidence_presentation.dart";
import "../eye_semantic_colors.dart";

/// Shared citizen evidence card for Emergency / Missing Person / Stolen Vehicle.
class EyeEvidenceCard extends StatelessWidget {
  const EyeEvidenceCard({
    required this.presentation,
    this.onPreviewTap,
    this.onPlay,
    this.onRetry,
    this.onRemove,
    this.uploadProgress,
    super.key,
  });

  final EvidencePresentation presentation;
  final VoidCallback? onPreviewTap;
  final VoidCallback? onPlay;
  final VoidCallback? onRetry;
  final VoidCallback? onRemove;
  final double? uploadProgress;

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    final failed = presentation.state == EvidenceDisplayState.failed;
    final previewWidth = presentation.mediaKind == EvidenceMediaKind.audio ? 92.0 : 112.0;
    final previewHeight = presentation.mediaKind == EvidenceMediaKind.audio ? 72.0 : 72.0;

    return Semantics(
      label: presentation.semanticsLabel,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          border: Border.all(color: const Color(0xFFD8DEE4)),
          borderRadius: BorderRadius.circular(12),
          color: semantics.cardSurface,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: previewWidth,
              height: previewHeight,
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: onPreviewTap,
                  borderRadius: BorderRadius.circular(10),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: _Preview(presentation: presentation),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    presentation.displayName,
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    presentation.statusLine ?? presentation.displayTimestamp,
                    style: TextStyle(
                      color:
                          failed ? const Color(0xFFB00020) : const Color(0xFF5C6670),
                      fontWeight: failed ? FontWeight.w600 : FontWeight.w400,
                    ),
                  ),
                  if (presentation.state == EvidenceDisplayState.uploading)
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: LinearProgressIndicator(
                        value: uploadProgress,
                      ),
                    ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      if (presentation.canPlay && onPlay != null)
                        _ActionButton(
                          icon: Icons.play_arrow,
                          label: "Play",
                          onPressed: onPlay!,
                        ),
                      if (presentation.canRetry && onRetry != null)
                        _ActionButton(
                          icon: Icons.replay,
                          label: "Retry",
                          onPressed: onRetry!,
                        ),
                      if (presentation.canRemove && onRemove != null)
                        _ActionButton(
                          icon: Icons.delete_outline,
                          label: "Remove",
                          onPressed: onRemove!,
                          destructive: true,
                        ),
                    ],
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

class _Preview extends StatelessWidget {
  const _Preview({required this.presentation});

  final EvidencePresentation presentation;

  @override
  Widget build(BuildContext context) {
    final surface = EyeSemanticColors.of(context).elevatedSurface;
    switch (presentation.mediaKind) {
      case EvidenceMediaKind.photo:
        final path = presentation.thumbnailPath;
        if (path != null && File(path).existsSync()) {
          return Image.file(
            File(path),
            fit: BoxFit.cover,
            width: double.infinity,
            height: double.infinity,
            errorBuilder: (_, __, ___) => _Placeholder(
              icon: Icons.broken_image_outlined,
              color: surface,
              label: "Preview unavailable",
            ),
          );
        }
        return _Placeholder(
          icon: Icons.image_outlined,
          color: surface,
          label: "No preview",
        );
      case EvidenceMediaKind.video:
        return Stack(
          fit: StackFit.expand,
          children: [
            ColoredBox(color: surface),
            const Center(
              child:
                  Icon(Icons.play_circle_fill, size: 56, color: Colors.white70),
            ),
            if (presentation.durationSeconds != null)
              Align(
                alignment: Alignment.bottomRight,
                child: Padding(
                  padding: const EdgeInsets.all(6),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.55),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      child: Text(
                        _clock(presentation.durationSeconds!),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        );
      case EvidenceMediaKind.audio:
        return _Placeholder(
          icon: Icons.graphic_eq,
          color: surface,
          label: "Audio",
        );
      case EvidenceMediaKind.document:
        return _Placeholder(
          icon: Icons.description_outlined,
          color: surface,
          label: "Document",
        );
    }
  }
}

class _Placeholder extends StatelessWidget {
  const _Placeholder({
    required this.icon,
    required this.color,
    required this.label,
  });

  final IconData icon;
  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: color,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 24),
            const SizedBox(height: 2),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.icon,
    required this.label,
    required this.onPressed,
    this.destructive = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onPressed;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final color = destructive ? const Color(0xFFB00020) : null;
    return OutlinedButton.icon(
      onPressed: onPressed,
      icon: Icon(icon, size: 18, color: color),
      label: Text(label, style: TextStyle(color: color)),
      style: OutlinedButton.styleFrom(
        foregroundColor: color,
        side: BorderSide(
          color: color ?? Theme.of(context).colorScheme.outline,
        ),
        visualDensity: VisualDensity.compact,
      ),
    );
  }
}

String _clock(int seconds) {
  final m = (seconds ~/ 60).toString().padLeft(2, "0");
  final s = (seconds % 60).toString().padLeft(2, "0");
  return "$m:$s";
}
