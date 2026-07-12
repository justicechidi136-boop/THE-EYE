import "package:flutter/material.dart";

import "tokens.dart";

abstract final class EyeSpacing {
  static const page = EdgeInsets.fromLTRB(
    EyeTokens.pagePadding,
    EyeTokens.pagePadding,
    EyeTokens.pagePadding,
    EyeTokens.contentBottomClearance,
  );

  static const authPage = EdgeInsets.symmetric(
    horizontal: EyeTokens.pagePadding,
    vertical: 24,
  );

  static const section = SizedBox(height: 16);
  static const fieldGap = SizedBox(height: 12);
  static const stackSm = SizedBox(height: 8);
  static const stackMd = SizedBox(height: 16);
  static const stackLg = SizedBox(height: 24);
}
