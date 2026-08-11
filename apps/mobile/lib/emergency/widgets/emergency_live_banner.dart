import "package:flutter/material.dart";

import "../../design_system/eye_semantic_colors.dart";
import "../active_emergency_contract.dart";

class EmergencyLiveBanner extends StatefulWidget {
  const EmergencyLiveBanner({
    super.key,
    required this.active,
    this.onViewLive,
  });

  final ActiveEmergencyActiveContract active;
  final VoidCallback? onViewLive;

  @override
  State<EmergencyLiveBanner> createState() => _EmergencyLiveBannerState();
}

class _EmergencyLiveBannerState extends State<EmergencyLiveBanner>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat();
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  bool get _videoLive {
    final state = widget.active.liveVideo?.displayState;
    return state == "Streaming" || state == "Live" || state == "Connected";
  }

  String get _title {
    if (_videoLive) return "Live video active";
    return "Emergency live";
  }

  String get _subtitle {
    final parts = <String>[];
    final watching = widget.active.liveVideo?.participantCount;
    if (watching != null && watching > 0) {
      parts.add(
        watching == 1 ? "1 responder aware" : "$watching responders aware",
      );
    } else if (widget.active.assignment != null ||
        widget.active.assignedAgencyName != null) {
      parts.add("Responders assigned");
    }
    final confidence = widget.active.reporterConfidence?.toLowerCase() ?? "";
    if (confidence.contains("community") ||
        widget.active.witnessCount != null) {
      parts.add("verification in progress");
    } else if (parts.isEmpty) {
      parts.add("Responders and nearby users are aware");
    }
    return parts.join(" · ");
  }

  String _elapsedLabel() {
    final elapsed = DateTime.now().difference(widget.active.reportedAt);
    final totalSeconds = elapsed.inSeconds.clamp(0, 99 * 3600);
    final minutes = (totalSeconds ~/ 60).toString().padLeft(2, "0");
    final seconds = (totalSeconds % 60).toString().padLeft(2, "0");
    return "$minutes:$seconds";
  }

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    final accent = colors.accentText;
    return Semantics(
      label: "$_title. $_subtitle",
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: _videoLive ? widget.onViewLive : null,
            child: Ink(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: accent.withValues(alpha: 0.35)),
                gradient: LinearGradient(
                  colors: [
                    accent.withValues(alpha: 0.14),
                    accent.withValues(alpha: 0.03),
                  ],
                ),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Row(
                children: [
                  AnimatedBuilder(
                    animation: _pulse,
                    builder: (context, child) {
                      final t = _pulse.value;
                      return SizedBox(
                        width: 18,
                        height: 18,
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            Transform.scale(
                              scale: 0.5 + (t * 1.1),
                              child: Opacity(
                                opacity: (1 - t) * 0.55,
                                child: Container(
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    border:
                                        Border.all(color: accent, width: 1.5),
                                  ),
                                ),
                              ),
                            ),
                            Container(
                              width: 9,
                              height: 9,
                              decoration: BoxDecoration(
                                color: accent,
                                shape: BoxShape.circle,
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _title,
                          style: TextStyle(
                            color: accent,
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 1),
                        Text(
                          _subtitle,
                          style: TextStyle(
                            color: colors.mutedText,
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    _elapsedLabel(),
                    style: TextStyle(
                      color: colors.mutedText,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      fontFeatures: const [FontFeature.tabularFigures()],
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
