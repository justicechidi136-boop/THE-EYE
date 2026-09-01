import "package:flutter/material.dart";

import "../../presentation/citizen_presentation.dart";
import "../eye_semantic_colors.dart";
import "eye_status_chip.dart";

/// Compact citizen incident list card (UI-007).
///
/// Shows only: title, public reference, status chip, reported date/time.
class EyeIncidentSummaryCard extends StatelessWidget {
  const EyeIncidentSummaryCard({
    required this.title,
    required this.publicReference,
    required this.statusLabel,
    required this.reportedAt,
    this.onTap,
    this.semanticsSuffix,
    this.unreadCount = 0,
    this.leadingIcon = Icons.radar,
    super.key,
  });

  final String title;
  final String publicReference;
  final String statusLabel;
  final DateTime? reportedAt;
  final VoidCallback? onTap;
  final String? semanticsSuffix;
  final int unreadCount;
  final IconData leadingIcon;

  factory EyeIncidentSummaryCard.fromIncidentFields({
    required String title,
    required String incidentId,
    required String status,
    DateTime? reportedAt,
    String? displayStatus,
    String? apiPublicReference,
    VoidCallback? onTap,
    String? semanticsSuffix,
    int unreadCount = 0,
    Key? key,
  }) {
    final reference = reportedAt == null
        ? (apiPublicReference?.trim().isNotEmpty == true
            ? apiPublicReference!.trim()
            : "EYE-PENDING")
        : resolveIncidentPublicReference(
            incidentId: incidentId,
            submittedAt: reportedAt,
            apiPublicReference: apiPublicReference,
          );
    final statusLabel = resolveCitizenIncidentStatusLabel(
      displayLabel: displayStatus,
      status: status,
    );
    return EyeIncidentSummaryCard(
      key: key,
      title: title,
      publicReference: reference,
      statusLabel: statusLabel,
      reportedAt: reportedAt,
      onTap: onTap,
      semanticsSuffix: semanticsSuffix,
      unreadCount: unreadCount,
    );
  }

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    final reported = reportedAt == null
        ? "Time unavailable"
        : CitizenDateTimeFormatter.formatReportedAt(reportedAt!);
    final semanticsLabel = [
      title,
      publicReference,
      statusLabel,
      "Reported $reported",
      if (unreadCount > 0) "$unreadCount unread updates",
      if (semanticsSuffix != null && semanticsSuffix!.trim().isNotEmpty)
        semanticsSuffix!.trim(),
    ].join(". ");

    return Semantics(
      button: onTap != null,
      label: semanticsLabel,
      child: Column(
        children: [
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 4, vertical: 12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: semantics.elevatedSurface,
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: Icon(
                        leadingIcon,
                        size: 24,
                        color: semantics.interactiveText,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            publicReference,
                            style: Theme.of(context)
                                .textTheme
                                .bodyMedium
                                ?.copyWith(
                                  fontWeight: FontWeight.w600,
                                ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            "Reported",
                            style:
                                Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color: Theme.of(context)
                                          .textTheme
                                          .bodySmall
                                          ?.color
                                          ?.withValues(alpha: 0.8),
                                    ),
                          ),
                          Text(
                            reported,
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        EyeStatusChip(label: statusLabel, compact: true),
                        if (unreadCount > 0)
                          Padding(
                            padding: const EdgeInsets.only(top: 8),
                            child: Badge(label: Text("$unreadCount")),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
          const Divider(height: 1),
        ],
      ),
    );
  }
}
