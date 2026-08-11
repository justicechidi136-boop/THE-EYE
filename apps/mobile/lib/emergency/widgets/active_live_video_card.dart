import "package:flutter/material.dart";

import "../../design_system/eye_semantic_colors.dart";
import "../active_emergency_contract.dart";
import "active_emergency_tokens.dart";

class ActiveLiveVideoCard extends StatelessWidget {
  const ActiveLiveVideoCard({
    super.key,
    required this.active,
    this.errorMessage,
    this.busy = false,
    this.onStart,
    this.onOpenSession,
    this.onStop,
    this.onSwitchCamera,
  });

  final ActiveEmergencyActiveContract active;
  final String? errorMessage;
  final bool busy;
  final VoidCallback? onStart;
  final VoidCallback? onOpenSession;
  final VoidCallback? onStop;
  final VoidCallback? onSwitchCamera;

  String get _displayState => active.liveVideo?.displayState ?? "NotStarted";

  bool get _isLive =>
      _displayState == "Streaming" ||
      _displayState == "Live" ||
      _displayState == "Connected";

  bool get _isConnecting =>
      _displayState == "Connecting" || _displayState == "Starting";

  bool get _sessionActive => _isLive || _isConnecting;

  bool get _canStart {
    if (onStart == null) return false;
    if (active.allowedActions.retryLiveVideo) return true;
    if (active.liveVideo?.retryAvailable == true) return true;
    return {
      "NotStarted",
      "Ended",
      "Stopped",
      "Completed",
      "RetryAvailable",
      "Disconnected",
      "Failed",
      "Error",
      "Unavailable",
    }.contains(_displayState);
  }

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    return ActiveEmergencyCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Semantics(
                  header: true,
                  child: Text(
                    "Live video",
                    style: TextStyle(
                      color: colors.bodyText,
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
              if (_isLive)
                Text(
                  "● STREAMING",
                  style: TextStyle(
                    color: colors.error,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                  ),
                )
              else if (_isConnecting)
                Text(
                  "CONNECTING",
                  style: TextStyle(
                    color: colors.accentText,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Semantics(
            label: _isLive
                ? "Live emergency video preview"
                : "Live video has not started",
            button: onOpenSession != null || onStart != null,
            child: AspectRatio(
              aspectRatio: 16 / 10,
              child: Material(
                color: colors.elevatedSurface,
                borderRadius: BorderRadius.circular(14),
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: _sessionActive ? onOpenSession : onStart,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      ColoredBox(color: const Color(0xFF1C2126)),
                      if (!_sessionActive)
                        Center(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Text(
                              "Live video has not started.",
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: colors.mutedText,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        )
                      else
                        Center(
                          child: Icon(
                            Icons.videocam,
                            size: 40,
                            color: colors.mutedText,
                          ),
                        ),
                      if (_isLive)
                        Positioned(
                          top: 10,
                          left: 10,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: colors.error,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.circle,
                                    size: 6, color: Colors.white),
                                SizedBox(width: 4),
                                Text(
                                  "LIVE",
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          if (errorMessage != null) ...[
            const SizedBox(height: 8),
            Text(
              errorMessage!,
              style: TextStyle(color: colors.errorText, fontSize: 12),
            ),
          ],
          const SizedBox(height: 12),
          if (_sessionActive)
            Row(
              children: [
                Expanded(
                  child: _ActionButton(
                    label: "Stop",
                    icon: Icons.stop,
                    danger: true,
                    enabled: !busy && onStop != null,
                    onPressed: onStop,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _ActionButton(
                    label: "Switch camera",
                    icon: Icons.cameraswitch_outlined,
                    enabled: !busy && onSwitchCamera != null,
                    onPressed: onSwitchCamera,
                  ),
                ),
              ],
            )
          else if (_canStart)
            _ActionButton(
              label: "Start live video",
              icon: Icons.videocam,
              enabled: !busy,
              onPressed: onStart,
              filled: true,
            ),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.label,
    required this.icon,
    this.onPressed,
    this.enabled = true,
    this.danger = false,
    this.filled = false,
  });

  final String label;
  final IconData icon;
  final VoidCallback? onPressed;
  final bool enabled;
  final bool danger;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    final foreground = danger
        ? colors.error
        : filled
            ? colors.textOnPrimary
            : colors.bodyText;
    final background = danger
        ? colors.error.withValues(alpha: 0.12)
        : filled
            ? colors.accentText
            : colors.elevatedSurface;
    final border = danger
        ? colors.error.withValues(alpha: 0.4)
        : filled
            ? colors.accentText
            : colors.border;

    return Semantics(
      button: true,
      enabled: enabled,
      label: label,
      child: Material(
        color: background,
        borderRadius: BorderRadius.circular(11),
        child: InkWell(
          onTap: enabled ? onPressed : null,
          borderRadius: BorderRadius.circular(11),
          child: Ink(
            height: 48,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(11),
              border: Border.all(color: border),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, size: 16, color: foreground),
                const SizedBox(width: 6),
                Text(
                  label,
                  style: TextStyle(
                    color: foreground,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
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
