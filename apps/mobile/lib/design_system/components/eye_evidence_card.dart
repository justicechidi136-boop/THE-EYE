import "dart:io";

import "package:flutter/material.dart";

import "../../presentation/evidence_presentation.dart";
import "../eye_semantic_colors.dart";

/// Shared citizen evidence card for Emergency / Missing Person / Stolen Vehicle.
class EyeEvidenceCard extends StatelessWidget {
  const EyeEvidenceCard({
    required this.presentation,
    this.onView,
    this.onPlay,
    this.onRetry,
    this.onRemove,
    this.uploadProgress,
    super.key,
  });

  final EvidencePresentation presentation;
  final VoidCallback? onView;
  final VoidCallback? onPlay;
  final VoidCallback? onRetry;
  final VoidCallback? onRemove;
  final double? uploadProgress;

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    final failed = presentation.state == EvidenceDisplayState.failed;
    final previewHeight =
        presentation.mediaKind == EvidenceMediaKind.audio ? 88.0 : 168.0;

    return Semantics(
      label: presentation.semanticsLabel,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          border: Border.all(color: const Color(0xFFD8DEE4)),
          borderRadius: BorderRadius.circular(14),
          color: semantics.cardSurface,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              height: previewHeight,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: _Preview(presentation: presentation),
              ),
            ),
            const SizedBox(height: 10),
            Text(
              presentation.displayName,
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
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
            if (presentation.durationSeconds != null &&
                presentation.mediaKind != EvidenceMediaKind.photo) ...[
              const SizedBox(height: 2),
              Text(
                _durationLabel(presentation.durationSeconds!),
                style: const TextStyle(color: Color(0xFF5C6670), fontSize: 13),
              ),
            ],
            if (presentation.state == EvidenceDisplayState.uploading)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: LinearProgressIndicator(
                  value: uploadProgress,
                ),
              ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (presentation.canView && onView != null)
                  _ActionButton(
                    icon: Icons.visibility_outlined,
                    label: "View",
                    onPressed: onView!,
                  ),
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
    );
  }

  static String _durationLabel(int seconds) {
    if (seconds >= 60) return "${seconds ~/ 60}m ${seconds % 60}s";
    return "$seconds sec";
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
            const Align(
              alignment: Alignment.bottomLeft,
              child: Padding(
                padding: EdgeInsets.all(8),
                child: Text(
                  "Video",
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
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
            Icon(icon, size: 40),
            const SizedBox(height: 6),
            Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
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
