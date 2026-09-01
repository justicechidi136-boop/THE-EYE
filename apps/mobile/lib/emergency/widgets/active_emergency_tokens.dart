import "package:flutter/material.dart";

import "../../design_system/eye_semantic_colors.dart";

/// Shared card chrome for the Active Emergency hub (Claude reference).
class ActiveEmergencyCard extends StatelessWidget {
  const ActiveEmergencyCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.flat = false,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final bool flat;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    if (flat) {
      return Padding(
        padding: padding,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            child,
            const SizedBox(height: 12),
            Divider(color: colors.divider, height: 1),
          ],
        ),
      );
    }
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.cardSurface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: colors.border),
      ),
      child: Padding(padding: padding, child: child),
    );
  }
}

class ActiveEmergencySectionLink extends StatelessWidget {
  const ActiveEmergencySectionLink({
    super.key,
    required this.label,
    this.onPressed,
  });

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    return TextButton(
      onPressed: onPressed,
      style: TextButton.styleFrom(
        foregroundColor: colors.accentText,
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
        minimumSize: const Size(48, 48),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
      child: Text(
        label,
        style: TextStyle(
          color: colors.accentText,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class ActiveEmergencyIconButton extends StatelessWidget {
  const ActiveEmergencyIconButton({
    super.key,
    required this.icon,
    required this.tooltip,
    this.onPressed,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    return Tooltip(
      message: tooltip,
      child: Material(
        color: colors.elevatedSurface,
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onPressed,
          child: Ink(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: colors.border),
            ),
            child: Icon(icon, size: 18, color: colors.bodyText),
          ),
        ),
      ),
    );
  }
}
