import "package:flutter/material.dart";

import "../tokens.dart";
import "../typography.dart";

/// Notification list card aligned to Figma node `719:3366`.
class EyeNotificationCard extends StatelessWidget {
  const EyeNotificationCard({
    required this.title,
    required this.timestamp,
    this.category,
    this.body,
    this.read = false,
    this.thumbnails = const [],
    this.onTap,
    super.key,
  });

  final String title;
  final String timestamp;
  final String? category;
  final String? body;
  final bool read;
  final List<Widget> thumbnails;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final onSurface = theme.colorScheme.onSurface;
    final muted = onSurface.withValues(alpha: read ? 0.55 : 0.72);
    final child = Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!read) ...[
            Padding(
              padding: const EdgeInsets.only(top: 6, right: 8),
              child: Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: theme.colorScheme.primary,
                  shape: BoxShape.circle,
                ),
              ),
            ),
          ] else
            const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (category != null) ...[
                  Text(
                    category!,
                    style: EyeTypography.fieldHint.copyWith(color: muted),
                  ),
                  const SizedBox(height: 4),
                ],
                Text(
                  title,
                  style: EyeTypography.fieldHint.copyWith(
                    color: onSurface,
                    fontWeight: read ? FontWeight.w500 : FontWeight.w700,
                  ),
                ),
                if (body != null && body!.trim().isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    body!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: EyeTypography.fieldHint.copyWith(
                      fontSize: 12,
                      color: muted,
                    ),
                  ),
                ],
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
                Text(
                  timestamp,
                  style: EyeTypography.fieldHint
                      .copyWith(fontSize: 12, color: muted),
                ),
              ],
            ),
          ),
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
