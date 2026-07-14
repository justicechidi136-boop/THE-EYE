import 'package:flutter/material.dart';

import '../eye_tokens.dart';
import 'hold_progress_ring.dart';

/// Large hold-to-SOS control used on watch face and countdown screens.
class LargeSosButton extends StatelessWidget {
  const LargeSosButton({
    super.key,
    required this.onHoldStart,
    required this.onHoldEnd,
    this.progress = 0,
    this.size = EyeTokens.sosButtonLarge,
    this.compact = false,
    this.label = 'SOS',
  });

  final VoidCallback onHoldStart;
  final VoidCallback onHoldEnd;
  final double progress;
  final double size;
  final bool compact;
  final String label;

  @override
  Widget build(BuildContext context) {
    final innerSize = compact ? EyeTokens.sosButtonHome : size;
    final fontSize = compact ? 10.0 : 12.0;

    return GestureDetector(
      onLongPressStart: (_) => onHoldStart(),
      onLongPressEnd: (_) => onHoldEnd(),
      onLongPressCancel: onHoldEnd,
      child: HoldProgressRing(
        progress: progress,
        size: innerSize,
        progressColor: compact ? EyeTokens.orange : EyeTokens.danger,
        pulsing: progress > 0,
        child: Container(
          width: innerSize,
          height: innerSize,
          decoration: BoxDecoration(
            color: compact ? EyeTokens.danger : Colors.transparent,
            shape: BoxShape.circle,
            border: compact
                ? null
                : Border.all(color: EyeTokens.danger, width: 2),
            boxShadow: compact
                ? null
                : [
                    BoxShadow(
                      color: EyeTokens.danger.withValues(alpha: 0.5),
                      blurRadius: 8,
                    ),
                  ],
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              color: compact ? EyeTokens.white : EyeTokens.danger,
              fontSize: fontSize,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      ),
    );
  }
}
