import "package:flutter/material.dart";

import "../eye_semantic_colors.dart";
import "../typography.dart";

/// THE EYE page header variants for citizen screens.
///
/// Use [EyePageHeader.root] for bottom-nav destinations (no back button).
/// Use [EyePageHeader.secondary] for drill-down pages (always shows Back).
///
/// Do not infer root vs secondary from [Navigator.canPop] — a root tab reached
/// through an unusual stack must still render as a root page.
class EyePageHeader extends StatelessWidget {
  const EyePageHeader.root({
    required this.title,
    this.actions,
    this.includeSafeArea = true,
    super.key,
  })  : showBack = false,
        onBack = null;

  const EyePageHeader.secondary({
    required this.title,
    this.onBack,
    this.actions,
    this.includeSafeArea = true,
    super.key,
  }) : showBack = true;

  /// Legacy constructor — prefer [.root] / [.secondary].
  const EyePageHeader({
    required this.title,
    this.showBack = true,
    this.onBack,
    this.actions,
    this.includeSafeArea = true,
    super.key,
  });

  final String title;
  final bool showBack;
  final VoidCallback? onBack;
  final List<Widget>? actions;
  final bool includeSafeArea;

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    final header = Padding(
      padding: EdgeInsets.fromLTRB(showBack ? 8 : 16, 8, 16, 0),
      child: showBack
          ? Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                IconButton(
                  tooltip: "Back",
                  onPressed: onBack ?? () => Navigator.of(context).maybePop(),
                  icon: Icon(
                    Icons.arrow_back,
                    color: semantics.interactiveText,
                    size: 24,
                  ),
                  padding: EdgeInsets.zero,
                  constraints:
                      const BoxConstraints(minWidth: 40, minHeight: 48),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Semantics(
                    header: true,
                    child: Text(
                      title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: EyeTypography.authHeading.copyWith(
                        color: semantics.bodyText,
                      ),
                    ),
                  ),
                ),
                if (actions != null) ...actions!,
              ],
            )
          : Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Semantics(
                    header: true,
                    child: Text(
                      title,
                      style: EyeTypography.authHeading.copyWith(
                        color: semantics.bodyText,
                      ),
                    ),
                  ),
                ),
                if (actions != null) ...actions!,
              ],
            ),
    );

    if (!includeSafeArea) return header;
    return SafeArea(
      bottom: false,
      child: header,
    );
  }
}
