import "package:flutter/material.dart";

import "../../design_system/eye_semantic_colors.dart";
import "../../presentation/citizen_presentation.dart";
import "../active_emergency_contract.dart";
import "active_emergency_tokens.dart";

class EmergencyTimelineCard extends StatelessWidget {
  const EmergencyTimelineCard({
    super.key,
    required this.entries,
    this.onViewAll,
    this.limit = 4,
  });

  final List<ActiveEmergencyTimelineEntry> entries;
  final VoidCallback? onViewAll;
  final int limit;

  static bool isCitizenSafeMessage(String message) {
    final lower = message.toLowerCase();
    if (lower.contains("verification confidence")) return false;
    if (RegExp(r"\b\d{1,3}%\b").hasMatch(message) &&
        lower.contains("confidence")) {
      return false;
    }
    if (RegExp(r"^[0-9a-f-]{36}$", caseSensitive: false).hasMatch(message)) {
      return false;
    }
    return true;
  }

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    final visible = entries
        .map(
          (entry) => (
            entry: entry,
            message: citizenTimelineMessage(
              eventType: entry.eventType,
              message: entry.message,
            ),
          ),
        )
        .where((item) => isCitizenSafeMessage(item.message))
        .take(limit)
        .toList(growable: false);

    return ActiveEmergencyCard(
      flat: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Semantics(
                  header: true,
                  child: Text(
                    "Timeline",
                    style: TextStyle(
                      color: colors.bodyText,
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
              ActiveEmergencySectionLink(
                label: "All",
                onPressed: onViewAll,
              ),
            ],
          ),
          if (visible.isEmpty)
            Text(
              "Your emergency has been received.",
              style: TextStyle(color: colors.mutedText, fontSize: 13),
            )
          else
            Column(
              children: [
                for (var i = 0; i < visible.length; i++)
                  _TimelineRow(
                    message: visible[i].message,
                    time: CitizenDateTimeFormatter.formatTime(
                      visible[i].entry.createdAt,
                    ),
                    color: _dotColor(colors, visible[i].entry.eventType),
                    isLast: i == visible.length - 1,
                  ),
              ],
            ),
        ],
      ),
    );
  }

  Color _dotColor(EyeSemanticColors colors, String eventType) {
    final lower = eventType.toLowerCase();
    if (lower.contains("video")) return colors.error;
    if (lower.contains("verif")) return colors.accentText;
    if (lower.contains("assign") || lower.contains("route")) {
      return colors.information;
    }
    return colors.accentText;
  }
}

class _TimelineRow extends StatelessWidget {
  const _TimelineRow({
    required this.message,
    required this.time,
    required this.color,
    required this.isLast,
  });

  final String message;
  final String time;
  final Color color;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    return Semantics(
      label: "$message, $time",
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 16,
              child: Column(
                children: [
                  Container(
                    width: 9,
                    height: 9,
                    margin: const EdgeInsets.only(top: 4),
                    decoration: BoxDecoration(
                      color: color,
                      shape: BoxShape.circle,
                    ),
                  ),
                  if (!isLast)
                    Expanded(
                      child: Container(
                        width: 1.5,
                        color: colors.border,
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Padding(
                padding: EdgeInsets.only(bottom: isLast ? 0 : 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      message,
                      style: TextStyle(
                        color: colors.bodyText,
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      time,
                      style: TextStyle(
                        color: colors.mutedText,
                        fontSize: 10.5,
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
