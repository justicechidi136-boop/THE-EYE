import "package:flutter/material.dart";

import "../../design_system/eye_semantic_colors.dart";
import "../../presentation/citizen_date_time.dart";
import "../active_emergency_contract.dart";
import "active_emergency_tokens.dart";

class EmergencyEvidenceCard extends StatelessWidget {
  const EmergencyEvidenceCard({
    super.key,
    required this.active,
    this.onViewAll,
    this.onAddMore,
  });

  final ActiveEmergencyActiveContract active;
  final VoidCallback? onViewAll;
  final VoidCallback? onAddMore;

  bool get _canAdd =>
      active.allowedActions.addEvidence ||
      active.allowedActions.uploadPhoto ||
      active.allowedActions.uploadVideo ||
      active.allowedActions.uploadVoice;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    final items = active.evidenceItems.take(3).toList(growable: false);
    final indexedItems = <({ActiveEmergencyEvidenceItem item, int index})>[];
    final counters = <String, int>{};
    for (final item in items) {
      final key = item.mediaType.toLowerCase();
      final index = (counters[key] ?? 0) + 1;
      counters[key] = index;
      indexedItems.add((item: item, index: index));
    }

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
                    "Evidence",
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
          if (items.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4, bottom: 4),
              child: Text(
                "No evidence submitted yet.",
                style: TextStyle(color: colors.mutedText, fontSize: 13),
              ),
            )
          else
            SizedBox(
              height: 78,
              child: Row(
                children: [
                  for (final indexed in indexedItems) ...[
                    Expanded(
                      child: _EvidenceTile(
                        item: indexed.item,
                        indexWithinType: indexed.index,
                      ),
                    ),
                    const SizedBox(width: 8),
                  ],
                  if (_canAdd)
                    Expanded(
                      child: _AddTile(onPressed: onAddMore),
                    )
                  else
                    for (var i = items.length; i < 3; i++) ...[
                      const Expanded(child: SizedBox.shrink()),
                      if (i < 2) const SizedBox(width: 8),
                    ],
                ],
              ),
            ),
          if (items.isEmpty && _canAdd) ...[
            const SizedBox(height: 10),
            Align(
              alignment: Alignment.centerLeft,
              child: ActiveEmergencySectionLink(
                label: "Add more",
                onPressed: onAddMore,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _EvidenceTile extends StatelessWidget {
  const _EvidenceTile({
    required this.item,
    required this.indexWithinType,
  });

  final ActiveEmergencyEvidenceItem item;
  final int indexWithinType;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    final kind = item.mediaType.toLowerCase();
    final base = switch (kind) {
      "video" => "Video $indexWithinType",
      "audio" => "Audio $indexWithinType",
      _ => "Photo $indexWithinType",
    };
    final label = item.durationSeconds == null
        ? base
        : "$base · ${_formatDuration(item.durationSeconds!)}";
    final icon = switch (kind) {
      "video" => Icons.play_circle_outline,
      "audio" => Icons.graphic_eq,
      _ => Icons.image_outlined,
    };

    return Semantics(
      label:
          "$label submitted ${CitizenDateTimeFormatter.formatTime(item.uploadedAt)}",
      child: Container(
        decoration: BoxDecoration(
          color: colors.elevatedSurface,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            Center(child: Icon(icon, color: colors.mutedText, size: 26)),
            if (kind == "video")
              Align(
                alignment: Alignment.center,
                child: Icon(
                  Icons.play_arrow_rounded,
                  color: colors.bodyText.withValues(alpha: 0.9),
                  size: 28,
                ),
              ),
            Positioned(
              left: 6,
              right: 6,
              bottom: 6,
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: colors.bodyText,
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDuration(int seconds) {
    final m = (seconds ~/ 60).toString().padLeft(2, "0");
    final s = (seconds % 60).toString().padLeft(2, "0");
    return "$m:$s";
  }
}

class _AddTile extends StatelessWidget {
  const _AddTile({this.onPressed});

  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    return Semantics(
      button: true,
      label: "Add more evidence",
      child: Material(
        color: colors.elevatedSurface,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(10),
          child: Ink(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: colors.border,
                style: BorderStyle.solid,
              ),
            ),
            child: Center(
              child: Icon(Icons.add, color: colors.mutedText, size: 28),
            ),
          ),
        ),
      ),
    );
  }
}
