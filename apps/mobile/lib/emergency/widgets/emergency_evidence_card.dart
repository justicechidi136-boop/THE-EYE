import "package:flutter/material.dart";

import "../../evidence/evidence_collection.dart";
import "../../evidence/evidence_item.dart";
import "../active_emergency_contract.dart";
import "active_emergency_tokens.dart";

typedef ActiveEvidenceUriLoader = Future<Uri> Function(
  ActiveEmergencyEvidenceItem item,
);

List<EvidenceItem> activeEmergencyEvidenceItems(
  ActiveEmergencyActiveContract active, {
  ActiveEvidenceUriLoader? loadUrl,
}) {
  final counters = <String, int>{};
  return active.evidenceItems.map((item) {
    final kind = item.mediaType.toLowerCase();
    final index = counters[kind] = (counters[kind] ?? 0) + 1;
    final prefix = kind.contains("video")
        ? "Video"
        : kind.contains("audio") || kind.contains("voice")
            ? "Audio"
            : "Photo";
    return EvidenceItem(
      id: item.id,
      mediaType: item.mediaType,
      label: "$prefix $index",
      createdAt: item.uploadedAt,
      durationSeconds: item.durationSeconds,
      loadAuthorizedUri: loadUrl == null ? null : () => loadUrl(item),
    );
  }).toList(growable: false);
}

class EmergencyEvidenceCard extends StatelessWidget {
  const EmergencyEvidenceCard({
    super.key,
    required this.active,
    this.loadUrl,
    this.onViewAll,
    this.onAddMore,
  });

  final ActiveEmergencyActiveContract active;
  final ActiveEvidenceUriLoader? loadUrl;
  final VoidCallback? onViewAll;
  final VoidCallback? onAddMore;

  bool get _canAdd =>
      active.allowedActions.addEvidence ||
      active.allowedActions.uploadPhoto ||
      active.allowedActions.uploadVideo ||
      active.allowedActions.uploadVoice;

  @override
  Widget build(BuildContext context) {
    return ActiveEmergencyCard(
      child: CompactEvidenceCollection(
        items: activeEmergencyEvidenceItems(active, loadUrl: loadUrl),
        emptyMessage: "No evidence submitted yet.",
        onViewAll: active.evidenceItems.isEmpty ? null : onViewAll,
        onAddMore: _canAdd ? onAddMore : null,
      ),
    );
  }
}
