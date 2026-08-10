import 'package:flutter/material.dart';

import 'field_theme.dart';

/// Canonical Field Operations brand asset paths (official logo — do not redesign).
abstract final class FieldBrandingAssets {
  static const logo = 'assets/branding/field_ops_logo.png';
  static const logoUi = 'assets/branding/field_ops_logo_ui.png';
}

/// Shared Field Ops identity block used on splash, login, and pairing.
class FieldOpsBrandHeader extends StatelessWidget {
  const FieldOpsBrandHeader({
    super.key,
    this.logoSize = 128,
    this.showTitle = true,
    this.showSubtitle = true,
    this.compact = false,
    this.status,
  });

  final double logoSize;
  final bool showTitle;
  final bool showSubtitle;
  final bool compact;
  final String? status;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final titleStyle =
        compact
            ? theme.textTheme.headlineMedium
            : theme.textTheme.headlineLarge;
    final gap = compact ? 12.0 : 20.0;

    return Semantics(
      label: 'THE EYE Field Operations',
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Image.asset(
            FieldBrandingAssets.logoUi,
            width: logoSize,
            height: logoSize,
            fit: BoxFit.contain,
            filterQuality: FilterQuality.high,
            semanticLabel: 'THE EYE Field Operations logo',
          ),
          if (showTitle) ...[
            SizedBox(height: gap),
            Text(
              'THE EYE FIELD OPS',
              textAlign: TextAlign.center,
              style: titleStyle?.copyWith(
                letterSpacing: 1.2,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
          if (showSubtitle) ...[
            const SizedBox(height: 6),
            Text(
              'FIELD OPERATIONS TABLET',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall?.copyWith(
                color: FieldColors.muted,
                letterSpacing: 1.4,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
          if (status != null) ...[
            SizedBox(height: compact ? 20 : 28),
            Text(
              status!,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium,
            ),
          ],
        ],
      ),
    );
  }
}
