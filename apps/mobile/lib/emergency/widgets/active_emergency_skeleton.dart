import "package:flutter/material.dart";

import "../../design_system/eye_semantic_colors.dart";
import "active_emergency_tokens.dart";

class ActiveEmergencySkeleton extends StatelessWidget {
  const ActiveEmergencySkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      children: [
        _Bone(height: 52, colors: colors, radius: 14),
        const SizedBox(height: 14),
        const ActiveEmergencyCard(child: _CardBones(lines: 3)),
        const SizedBox(height: 14),
        const ActiveEmergencyCard(child: _CardBones(lines: 2)),
        const SizedBox(height: 14),
        const ActiveEmergencyCard(child: _CardBones(lines: 3, tallFirst: true)),
        const SizedBox(height: 14),
        const ActiveEmergencyCard(child: _CardBones(lines: 2)),
        const SizedBox(height: 14),
        const ActiveEmergencyCard(child: _CardBones(lines: 3)),
      ],
    );
  }
}

class _CardBones extends StatelessWidget {
  const _CardBones({required this.lines, this.tallFirst = false});

  final int lines;
  final bool tallFirst;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < lines; i++) ...[
          if (i > 0) const SizedBox(height: 10),
          _Bone(
            height: tallFirst && i == 0 ? 120 : 14,
            colors: colors,
            widthFactor: i == lines - 1 ? 0.65 : 1,
          ),
        ],
      ],
    );
  }
}

class _Bone extends StatelessWidget {
  const _Bone({
    required this.height,
    required this.colors,
    this.radius = 8,
    this.widthFactor = 1,
  });

  final double height;
  final EyeSemanticColors colors;
  final double radius;
  final double widthFactor;

  @override
  Widget build(BuildContext context) {
    return FractionallySizedBox(
      widthFactor: widthFactor,
      alignment: Alignment.centerLeft,
      child: Container(
        height: height,
        decoration: BoxDecoration(
          color: colors.elevatedSurface,
          borderRadius: BorderRadius.circular(radius),
        ),
      ),
    );
  }
}
