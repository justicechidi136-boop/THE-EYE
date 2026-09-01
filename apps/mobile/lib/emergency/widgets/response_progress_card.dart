import "package:flutter/material.dart";

import "../../design_system/eye_semantic_colors.dart";
import "../active_emergency_contract.dart";
import "../active_emergency_progress_presentation.dart";
import "active_emergency_tokens.dart";

class ResponseProgressCard extends StatelessWidget {
  const ResponseProgressCard({
    super.key,
    required this.active,
    this.onViewDetails,
  });

  final ActiveEmergencyActiveContract active;
  final VoidCallback? onViewDetails;

  @override
  Widget build(BuildContext context) {
    final steps = collapseActiveEmergencyProgress(active.progressStages);
    final note = activeEmergencyProgressNote(
      steps: steps,
      assignedAgencyName: active.assignedAgencyName,
      witnessSummary: active.witnessSummary,
    );
    return EmergencyResponseProgressCard(
      steps: steps,
      note: note,
      onViewDetails: onViewDetails,
    );
  }
}

class EmergencyResponseProgressCard extends StatelessWidget {
  const EmergencyResponseProgressCard({
    super.key,
    required this.steps,
    required this.note,
    this.title = "Response progress",
    this.onViewDetails,
  });

  final List<ActiveEmergencyCitizenProgressStep> steps;
  final String note;
  final String title;
  final VoidCallback? onViewDetails;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    final activeIndex = steps.indexWhere(
      (step) => step.state == ActiveEmergencyProgressStageState.current,
    );
    final completedCount = steps
        .where(
            (step) => step.state == ActiveEmergencyProgressStageState.complete)
        .length;
    final fillFraction = steps.isEmpty
        ? 0.0
        : ((activeIndex >= 0 ? activeIndex : completedCount - 1)
                .clamp(0, steps.length - 1) /
            (steps.length - 1));

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
                    title,
                    style: TextStyle(
                      color: colors.bodyText,
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
              if (onViewDetails != null)
                ActiveEmergencySectionLink(
                  label: "Details",
                  onPressed: onViewDetails,
                ),
            ],
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 58,
            child: LayoutBuilder(
              builder: (context, constraints) {
                return Stack(
                  alignment: Alignment.topCenter,
                  children: [
                    Positioned(
                      top: 15,
                      left: 14,
                      right: 14,
                      child: Container(height: 2, color: colors.border),
                    ),
                    Positioned(
                      top: 15,
                      left: 14,
                      child: Container(
                        height: 2,
                        width: (constraints.maxWidth - 28) * fillFraction,
                        color: colors.accentText,
                      ),
                    ),
                    Row(
                      children: [
                        for (final step in steps)
                          Expanded(
                            child: _StepNode(step: step),
                          ),
                      ],
                    ),
                  ],
                );
              },
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: colors.elevatedSurface,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.schedule, size: 14, color: colors.mutedText),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    note,
                    style: TextStyle(
                      color: colors.mutedText,
                      fontSize: 12,
                      height: 1.35,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StepNode extends StatelessWidget {
  const _StepNode({required this.step});

  final ActiveEmergencyCitizenProgressStep step;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    final done = step.state == ActiveEmergencyProgressStageState.complete;
    final current = step.state == ActiveEmergencyProgressStageState.current;
    final labelColor = done || current
        ? colors.bodyText
        : colors.mutedText.withValues(alpha: 0.8);

    return Semantics(
      label: "${step.label}, ${step.subLabel ?? citizenState(step.state)}",
      child: Column(
        children: [
          Container(
            width: 16,
            height: 16,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: done ? colors.accentText : colors.background,
              border: Border.all(
                color: done || current ? colors.accentText : colors.border,
                width: 2,
              ),
              boxShadow: current
                  ? [
                      BoxShadow(
                        color: colors.accentText.withValues(alpha: 0.25),
                        blurRadius: 0,
                        spreadRadius: 3,
                      ),
                    ]
                  : null,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            step.label,
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: labelColor,
              fontSize: 9.5,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  String citizenState(ActiveEmergencyProgressStageState state) {
    return switch (state) {
      ActiveEmergencyProgressStageState.pending => "Pending",
      ActiveEmergencyProgressStageState.current => "In progress",
      ActiveEmergencyProgressStageState.complete => "Complete",
      ActiveEmergencyProgressStageState.skipped => "Skipped",
    };
  }
}
