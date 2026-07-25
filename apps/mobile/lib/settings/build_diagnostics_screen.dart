import "package:flutter/material.dart";

import "../config/build_diagnostics.dart";
import "../design_system/eye_semantic_colors.dart";

class BuildDiagnosticsScreen extends StatelessWidget {
  const BuildDiagnosticsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    final rows = BuildDiagnostics.snapshot();
    return Scaffold(
      backgroundColor: semantics.background,
      appBar: AppBar(
        backgroundColor: semantics.surface,
        foregroundColor: semantics.bodyText,
        surfaceTintColor: Colors.transparent,
        title: const Text("Build diagnostics"),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            "Staging-safe runtime identity. No tokens or secrets are shown.",
            style: TextStyle(color: semantics.secondaryText),
          ),
          const SizedBox(height: 16),
          ...rows.map(
            (row) => ListTile(
              tileColor: semantics.cardSurface,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: semantics.border),
              ),
              title: Text(
                row.$1,
                style: TextStyle(
                  color: semantics.secondaryText,
                  fontSize: 13,
                ),
              ),
              subtitle: Text(
                row.$2,
                style: TextStyle(
                  color: semantics.bodyText,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
