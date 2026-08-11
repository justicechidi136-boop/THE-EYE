import "package:flutter/material.dart";

import "../../design_system/eye_semantic_colors.dart";

class CommunicationLiveRail extends StatefulWidget {
  const CommunicationLiveRail({
    super.key,
    this.reportedAt,
    this.subtitle = "Overview still updating in the background",
  });

  final DateTime? reportedAt;
  final String subtitle;

  @override
  State<CommunicationLiveRail> createState() => _CommunicationLiveRailState();
}

class _CommunicationLiveRailState extends State<CommunicationLiveRail>
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

  String _elapsed() {
    final start = widget.reportedAt;
    if (start == null) return "--:--";
    final total =
        DateTime.now().difference(start).inSeconds.clamp(0, 99 * 3600);
    final minutes = (total ~/ 60).toString().padLeft(2, "0");
    final seconds = (total % 60).toString().padLeft(2, "0");
    return "$minutes:$seconds";
  }

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    final accent = colors.accentText;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: Semantics(
        label: "Emergency live. ${widget.subtitle}",
        child: DecoratedBox(
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
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: [
                AnimatedBuilder(
                  animation: _pulse,
                  builder: (context, _) {
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
                                  border: Border.all(color: accent, width: 1.5),
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
                        "Emergency live",
                        style: TextStyle(
                          color: accent,
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        widget.subtitle,
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
                  _elapsed(),
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
    );
  }
}
