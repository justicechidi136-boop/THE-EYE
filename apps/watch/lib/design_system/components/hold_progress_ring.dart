import 'package:flutter/material.dart';

import '../eye_tokens.dart';

/// Circular hold-to-activate progress ring (SOS / report confirm).
class HoldProgressRing extends StatelessWidget {
  const HoldProgressRing({
    super.key,
    required this.progress,
    required this.child,
    this.size = EyeTokens.sosButtonLarge,
    this.strokeWidth = EyeTokens.holdRingStroke,
    this.progressColor = EyeTokens.danger,
    this.trackColor,
    this.pulsing = false,
  });

  final double progress;
  final Widget child;
  final double size;
  final double strokeWidth;
  final Color progressColor;
  final Color? trackColor;
  final bool pulsing;

  @override
  Widget build(BuildContext context) {
    final track = trackColor ?? progressColor.withValues(alpha: 0.15);
    final ring = SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          if (progress > 0)
            CircularProgressIndicator(
              value: progress.clamp(0.0, 1.0),
              strokeWidth: strokeWidth,
              color: progressColor,
              backgroundColor: track,
            ),
          child,
        ],
      ),
    );

    if (!pulsing) return ring;

    return AnimatedContainer(
      duration: const Duration(milliseconds: EyeTokens.sosPulseMs),
      curve: Curves.easeInOut,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: progressColor.withValues(alpha: 0.35 + progress * 0.25),
            blurRadius: 8 + progress * 12,
          ),
        ],
      ),
      child: ring,
    );
  }
}
