import "package:flutter/material.dart";

import "../../design_system/eye_semantic_colors.dart";
import "../../presentation/citizen_presentation.dart";
import "../active_emergency_contract.dart";
import "active_emergency_tokens.dart";

class EmergencyOverviewCard extends StatelessWidget {
  const EmergencyOverviewCard({
    super.key,
    required this.active,
    this.onViewMap,
  });

  final ActiveEmergencyActiveContract active;
  final VoidCallback? onViewMap;

  String get _location {
    return active.reportedLocation.address?.trim().isNotEmpty == true
        ? active.reportedLocation.address!.trim()
        : (active.reportedLocation.locationLabel?.trim().isNotEmpty == true
            ? active.reportedLocation.locationLabel!.trim()
            : "Location recorded");
  }

  String get _agency {
    return active.assignedAgencyName?.trim().isNotEmpty == true
        ? active.assignedAgencyName!.trim()
        : (active.assignment?.agencyName?.trim().isNotEmpty == true
            ? active.assignment!.agencyName!.trim()
            : "Awaiting agency");
  }

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    final reference = resolveIncidentPublicReference(
      incidentId: active.incidentId,
      submittedAt: active.reportedAt,
      apiPublicReference: active.publicReference,
    );
    final status = resolveCitizenIncidentStatusLabel(
      displayLabel: active.displayLabel,
      status: active.status,
    );

    return ActiveEmergencyCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _StatusGlyph(label: status, colors: colors),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      reference,
                      style: TextStyle(
                        color: colors.bodyText,
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.2,
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Icon(
                          Icons.location_on_outlined,
                          size: 14,
                          color: colors.information,
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            _location,
                            style: TextStyle(
                              color: colors.mutedText,
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: colors.accentText.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(
                            color: colors.accentText.withValues(alpha: 0.35),
                          ),
                        ),
                        child: Text(
                          status,
                          style: TextStyle(
                            color: colors.accentText,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 14),
            child: Divider(height: 1, color: colors.divider),
          ),
          Row(
            children: [
              Expanded(
                child: _Field(
                  label: "Reported",
                  value: CitizenDateTimeFormatter.formatTime(active.reportedAt),
                  mono: true,
                ),
              ),
              Expanded(
                child: _Field(
                  label: "Response agency",
                  value: _agency,
                ),
              ),
            ],
          ),
          if (active.description?.trim().isNotEmpty == true) ...[
            const SizedBox(height: 12),
            _Field(
              label: "Description",
              value: active.description!.trim(),
            ),
          ],
          if (onViewMap != null) ...[
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerLeft,
              child: ActiveEmergencySectionLink(
                label: "View on map",
                onPressed: onViewMap,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _StatusGlyph extends StatelessWidget {
  const _StatusGlyph({required this.label, required this.colors});

  final String label;
  final EyeSemanticColors colors;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: "Status $label",
      child: Container(
        width: 56,
        height: 56,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: colors.accentText, width: 3),
          color: colors.elevatedSurface,
        ),
        alignment: Alignment.center,
        child: Icon(
          Icons.shield_outlined,
          color: colors.accentText,
          size: 22,
        ),
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({
    required this.label,
    required this.value,
    this.mono = false,
  });

  final String label;
  final String value;
  final bool mono;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: TextStyle(
            color: colors.mutedText.withValues(alpha: 0.85),
            fontSize: 10.5,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          value,
          style: TextStyle(
            color: colors.bodyText,
            fontSize: 13,
            fontWeight: FontWeight.w600,
            fontFeatures: mono ? const [FontFeature.tabularFigures()] : null,
          ),
        ),
      ],
    );
  }
}
