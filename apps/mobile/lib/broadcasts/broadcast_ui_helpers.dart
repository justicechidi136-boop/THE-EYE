import "package:flutter/material.dart";

import "../brand.dart";
import "../presentation/citizen_presentation.dart";

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
  if (diff.isNegative) {
    return formatBroadcastExpiry(value);
  }
  if (diff.inMinutes < 1) return "Just now";
  if (diff.inHours < 1) return "${diff.inMinutes}m ago";
  if (diff.inDays < 1) return "${diff.inHours}h ago";
  if (diff.inDays < 7) return "${diff.inDays}d ago";
  return formatCitizenDateTime(value);
}

/// Labels for a future expiry timestamp (never "Just now").
String formatBroadcastExpiry(DateTime expiresAt) {
  final remaining = expiresAt.difference(DateTime.now());
  if (remaining.isNegative) return "Expired";
  if (remaining.inMinutes < 1) return "Expires in under a minute";
  if (remaining.inHours < 1) return "Expires in ${remaining.inMinutes}m";
  if (remaining.inDays < 1) return "Expires in ${remaining.inHours}h";
  if (remaining.inDays < 7) return "Expires in ${remaining.inDays}d";
  return "Expires ${formatCitizenDateTime(expiresAt)}";
}
