import "package:flutter/material.dart";

import "../tokens.dart";
import "../typography.dart";

/// Notification list card aligned to Figma node `719:3366`.
class EyeNotificationCard extends StatelessWidget {
  const EyeNotificationCard({
    required this.title,
    required this.timestamp,
    this.category,
    this.thumbnails = const [],
    this.onTap,
    super.key,
  });

  final String title;
  final String timestamp;
  final String? category;
  final List<Widget> thumbnails;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final onSurface = theme.colorScheme.onSurface;
    final muted = onSurface.withValues(alpha: 0.72);
    final child = Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(EyeTokens.radiusSm),
        boxShadow: [
          BoxShadow(
            color: theme.shadowColor.withValues(alpha: 0.25),
            blurRadius: 4,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (category != null) ...[
            Text(category!, style: EyeTypography.fieldHint.copyWith(color: muted)),
            const SizedBox(height: 4),
          ],
          Text(title,
              style: EyeTypography.fieldHint.copyWith(color: onSurface)),
          if (thumbnails.isNotEmpty) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                for (var i = 0; i < thumbnails.length; i++) ...[
                  if (i > 0) const SizedBox(width: 8),
                  thumbnails[i],
                ],
              ],
            ),
          ],
          const SizedBox(height: 4),
          Text(timestamp,
              style: EyeTypography.fieldHint
                  .copyWith(fontSize: 12, color: muted)),
        ],
      ),
    );

    if (onTap == null) return child;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(EyeTokens.radiusSm),
        child: child,
      ),
    );
  }
}

class EyeNotificationThumbnail extends StatelessWidget {
  const EyeNotificationThumbnail({
    required this.child,
    super.key,
  });

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(EyeTokens.radiusSm),
      child: SizedBox(width: 50, height: 50, child: child),
    );
  }
}
