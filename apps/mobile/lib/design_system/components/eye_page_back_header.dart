import "package:flutter/material.dart";

import "eye_page_header.dart";

/// Backward-compatible alias for [EyePageHeader].
///
/// Prefer [EyePageHeader.root] / [EyePageHeader.secondary] for new code.
/// When [showBack] is false this renders a root header; otherwise secondary.
class EyePageBackHeader extends StatelessWidget {
  const EyePageBackHeader({
    this.title,
    this.onBack,
    this.showBack = true,
    this.includeSafeArea = false,
    super.key,
  });

  final String? title;
  final VoidCallback? onBack;
  final bool showBack;

  /// Defaults to false so existing ListView padding layouts are unchanged.
  final bool includeSafeArea;

  @override
  Widget build(BuildContext context) {
    final resolvedTitle = title ?? "";
    if (showBack) {
      return EyePageHeader.secondary(
        title: resolvedTitle,
        onBack: onBack,
        includeSafeArea: includeSafeArea,
      );
    }
    return EyePageHeader.root(
      title: resolvedTitle,
      includeSafeArea: includeSafeArea,
    );
  }
}
