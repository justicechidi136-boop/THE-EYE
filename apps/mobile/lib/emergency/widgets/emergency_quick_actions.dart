import "package:flutter/material.dart";

import "../../design_system/eye_semantic_colors.dart";
import "../active_emergency_contract.dart";
import "../incident_communication_contract.dart";

class EmergencyQuickActions extends StatelessWidget {
  const EmergencyQuickActions({
    super.key,
    required this.allowedActions,
    required this.communication,
    this.onEvidence,
    this.onLocation,
    this.onNote,
    this.onCommunicate,
  });

  final ActiveEmergencyAllowedActions allowedActions;
  final IncidentCommunicationSummary communication;
  final VoidCallback? onEvidence;
  final VoidCallback? onLocation;
  final VoidCallback? onNote;
  final VoidCallback? onCommunicate;

  @override
  Widget build(BuildContext context) {
    final canEvidence = allowedActions.addEvidence ||
        allowedActions.uploadPhoto ||
        allowedActions.uploadVideo ||
        allowedActions.uploadVoice;
    final canNote = allowedActions.addWrittenUpdate || allowedActions.addUpdate;
    final canLocation = allowedActions.updateLocation;
    final canCommunicate =
        communication.allowedCommunicationActions.openThread ||
            communication.conversationAvailable;

    return Semantics(
      label: "Quick actions",
      child: GridView.count(
        crossAxisCount: 4,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 0.78,
        children: [
          _QuickActionTile(
            label: "Evidence",
            icon: Icons.photo_camera_outlined,
            tone: _QuickTone.purple,
            enabled: canEvidence,
            onPressed: onEvidence,
          ),
          _QuickActionTile(
            label: "Location",
            icon: Icons.location_on_outlined,
            tone: _QuickTone.blue,
            enabled: canLocation,
            onPressed: onLocation,
          ),
          _QuickActionTile(
            label: "Note",
            icon: Icons.edit_outlined,
            tone: _QuickTone.orange,
            enabled: canNote,
            onPressed: onNote,
          ),
          _QuickActionTile(
            label: "Communicate",
            icon: Icons.chat_bubble,
            tone: _QuickTone.primary,
            enabled: canCommunicate,
            onPressed: onCommunicate,
          ),
        ],
      ),
    );
  }
}

enum _QuickTone { purple, blue, orange, primary }

class _QuickActionTile extends StatelessWidget {
  const _QuickActionTile({
    required this.label,
    required this.icon,
    required this.tone,
    required this.enabled,
    this.onPressed,
  });

  final String label;
  final IconData icon;
  final _QuickTone tone;
  final bool enabled;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    final Color iconBg;
    final Color iconFg;
    final Color tileBg;
    final Color border;

    switch (tone) {
      case _QuickTone.purple:
        iconBg = const Color(0xFF241A3A);
        iconFg = const Color(0xFFA78BFA);
        tileBg = colors.elevatedSurface;
        border = colors.border;
      case _QuickTone.blue:
        iconBg = colors.information.withValues(alpha: 0.12);
        iconFg = colors.information;
        tileBg = colors.elevatedSurface;
        border = colors.border;
      case _QuickTone.orange:
        iconBg = colors.accentText.withValues(alpha: 0.12);
        iconFg = colors.accentText;
        tileBg = colors.elevatedSurface;
        border = colors.border;
      case _QuickTone.primary:
        iconBg = colors.accentText;
        iconFg = colors.textOnPrimary;
        tileBg = colors.accentText.withValues(alpha: 0.12);
        border = colors.accentText.withValues(alpha: 0.4);
    }

    return Semantics(
      button: true,
      enabled: enabled,
      label: label,
      child: Opacity(
        opacity: enabled ? 1 : 0.45,
        child: Material(
          color: tileBg,
          borderRadius: BorderRadius.circular(14),
          child: InkWell(
            onTap: enabled ? onPressed : null,
            borderRadius: BorderRadius.circular(14),
            child: Ink(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: border),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 12),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: iconBg,
                      borderRadius: BorderRadius.circular(9),
                    ),
                    child: Icon(icon, size: 16, color: iconFg),
                  ),
                  const SizedBox(height: 7),
                  Text(
                    label,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: colors.bodyText,
                      fontSize: 10.5,
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
