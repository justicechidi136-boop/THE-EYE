import "package:flutter/material.dart";

import "../design_system/eye_semantic_colors.dart";
import "../navigation/navigate_back_or_home.dart";

/// Scaffold that always applies THE EYE semantic surfaces (dark-mode safe).
class EyeScaffold extends StatelessWidget {
  const EyeScaffold({
    required this.title,
    required this.body,
    this.actions,
    this.floatingActionButton,
    this.useNavigateBackOrHome = false,
    super.key,
  });

  final String title;
  final Widget body;
  final List<Widget>? actions;
  final Widget? floatingActionButton;
  final bool useNavigateBackOrHome;

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
        leading: useNavigateBackOrHome
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () => navigateBackOrHome(context),
              )
            : null,
        automaticallyImplyLeading: !useNavigateBackOrHome,
      ),
      floatingActionButton: floatingActionButton,
      body: body,
    );
  }
}
