import "package:flutter/material.dart";

import "../design_system/eye_semantic_colors.dart";

/// Scaffold that always applies THE EYE semantic surfaces (dark-mode safe).
class EyeScaffold extends StatelessWidget {
  const EyeScaffold({
    required this.title,
    required this.body,
    this.actions,
    this.floatingActionButton,
    super.key,
  });

  final String title;
  final Widget body;
  final List<Widget>? actions;
  final Widget? floatingActionButton;

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    return Scaffold(
      backgroundColor: semantics.background,
      appBar: AppBar(
        backgroundColor: semantics.surface,
        foregroundColor: semantics.bodyText,
        surfaceTintColor: Colors.transparent,
        title: Text(title),
        actions: actions,
      ),
      floatingActionButton: floatingActionButton,
      body: body,
    );
  }
}
