import "package:flutter/material.dart";

import "../../design_system/eye_semantic_colors.dart";
import "../active_emergency_contract.dart";
import "active_emergency_tokens.dart";

/// Your status segmented control from the Claude reference.
///
/// API mapping:
/// - Ongoing → `StillOngoing`
/// - Resolved → `Resolved`
/// - Unsafe → `Unsure` (citizen label only)
class EmergencyStatusUpdateCard extends StatelessWidget {
  const EmergencyStatusUpdateCard({
    super.key,
    required this.allowedActions,
    this.busy = false,
    this.onOngoing,
    this.onResolved,
    this.onUnsafe,
  });

  final ActiveEmergencyAllowedActions allowedActions;
  final bool busy;
  final VoidCallback? onOngoing;
  final VoidCallback? onResolved;
  final VoidCallback? onUnsafe;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    final canOngoing = allowedActions.confirmStillOngoing;
    final canResolved = allowedActions.confirmResolved;
    final canUnsafe = canOngoing || canResolved;

    return ActiveEmergencyCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            child: Text(
              "Your status",
              style: TextStyle(
                color: colors.bodyText,
                fontSize: 14.5,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _StatusSeg(
                  label: "Ongoing",
                  subtitle: "Still happening",
                  icon: Icons.autorenew,
                  selected: true,
                  tone: _SegTone.orange,
                  enabled: !busy && canOngoing,
                  onPressed: onOngoing,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _StatusSeg(
                  label: "Resolved",
                  subtitle: "I am safe now",
                  icon: Icons.check,
                  tone: _SegTone.green,
                  enabled: !busy && canResolved,
                  onPressed: onResolved,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _StatusSeg(
                  label: "Unsafe",
                  subtitle: "Cannot respond",
                  icon: Icons.shield_outlined,
                  tone: _SegTone.red,
                  enabled: !busy && canUnsafe,
                  onPressed: onUnsafe,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.shield_outlined, size: 14, color: colors.mutedText),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  "Your updates help responders make informed decisions and keep everyone safe.",
                  style: TextStyle(
                    color: colors.mutedText,
                    fontSize: 12,
                    height: 1.35,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

enum _SegTone { orange, green, red }

class _StatusSeg extends StatelessWidget {
  const _StatusSeg({
    required this.label,
    required this.subtitle,
    required this.icon,
    required this.tone,
    required this.enabled,
    this.selected = false,
    this.onPressed,
  });

  final String label;
  final String subtitle;
  final IconData icon;
  final _SegTone tone;
  final bool enabled;
  final bool selected;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    final Color accent;
    switch (tone) {
      case _SegTone.orange:
        accent = colors.accentText;
      case _SegTone.green:
        accent = colors.success;
      case _SegTone.red:
        accent = colors.error;
    }

    return Semantics(
      button: true,
      enabled: enabled,
      label: "$label. $subtitle",
      child: Opacity(
        opacity: enabled ? 1 : 0.45,
        child: Material(
          color: selected ? accent.withValues(alpha: 0.12) : colors.cardSurface,
          borderRadius: BorderRadius.circular(13),
          child: InkWell(
            onTap: enabled ? onPressed : null,
            borderRadius: BorderRadius.circular(13),
            child: Ink(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(13),
                border: Border.all(
                  color: selected ? accent : colors.border,
                  width: selected ? 1.5 : 1,
                ),
              ),
              child: Column(
                children: [
                  Container(
                    width: 26,
                    height: 26,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: selected ? accent : accent.withValues(alpha: 0.12),
                    ),
                    child: Icon(
                      icon,
                      size: 14,
                      color: selected ? colors.textOnPrimary : accent,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    label,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: colors.bodyText,
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: colors.mutedText,
                      fontSize: 9,
                      height: 1.25,
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
