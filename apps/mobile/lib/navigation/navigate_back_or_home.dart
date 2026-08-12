import "package:flutter/material.dart";

void navigateBackOrHome(BuildContext context) {
  if (Navigator.of(context).canPop()) {
    Navigator.of(context).pop();
    return;
  }
  Navigator.of(context).pushReplacementNamed("/home");
}
