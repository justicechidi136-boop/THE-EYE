import "package:flutter/material.dart";

/// Pops the current route when possible; otherwise returns to Home.
///
/// Active Emergency is often opened with [Navigator.pushReplacementNamed]
/// (e.g. splash restore), so [Navigator.maybePop] alone leaves the back
/// control looking tappable but doing nothing.
void navigateBackOrHome(BuildContext context) {
  final navigator = Navigator.of(context);
  if (navigator.canPop()) {
    navigator.pop();
    return;
  }
  navigator.pushReplacementNamed("/home");
}
