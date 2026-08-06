import "package:flutter/material.dart";

import "../brand.dart";

void showBroadcastSnackBar(
  BuildContext context,
  String message, {
  bool isError = false,
}) {
  final messenger = ScaffoldMessenger.maybeOf(context);
  if (messenger == null) return;
  messenger.hideCurrentSnackBar();
  messenger.showSnackBar(
    SnackBar(
      content: Text(message),
      backgroundColor: isError ? BrandColors.danger : BrandColors.green,
      behavior: SnackBarBehavior.floating,
      duration: Duration(seconds: isError ? 5 : 3),
    ),
  );
}

String formatBroadcastAge(DateTime value) {
  final diff = DateTime.now().difference(value);
  if (diff.inMinutes < 1) return "Just now";
  if (diff.inHours < 1) return "${diff.inMinutes}m ago";
  if (diff.inDays < 1) return "${diff.inHours}h ago";
  if (diff.inDays < 7) return "${diff.inDays}d ago";
  final local = value.toLocal();
  return "${local.day}/${local.month}/${local.year}";
}
