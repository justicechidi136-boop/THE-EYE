import "package:flutter/material.dart";

import "../../presentation/citizen_presentation.dart";
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
    this.unreadCount = 0,
    this.leadingIcon = Icons.radar,
    super.key,
  });

  final String title;
  final String publicReference;
  final String statusLabel;
  final DateTime? reportedAt;
  final VoidCallback? onTap;
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
      unreadCount: unreadCount,
    );
  }

  @override
  Widget build(BuildContext context) {
    final reported = reportedAt == null
        ? "Time unavailable"
        : CitizenDateTimeFormatter.formatReportedAt(reportedAt!);
    final semanticsLabel = [
      title,
      publicReference,
      statusLabel,
      "Reported $reported",
      if (unreadCount > 0) "$unreadCount unread updates",
    ].join(". ");

    return Semantics(
      button: onTap != null,
      label: semanticsLabel,
      child: Card(
        margin: const EdgeInsets.only(bottom: 12),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(leadingIcon, size: 28),
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
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        "Reported",
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
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
    );
  }
}
