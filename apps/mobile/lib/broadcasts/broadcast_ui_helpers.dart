import "package:flutter/material.dart";

import "../brand.dart";
import "../presentation/broadcast_expiry_presenter.dart";
import "../presentation/citizen_date_time.dart";

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

String formatBroadcastAge(DateTime value, {DateTime? now}) {
  final reference = now ?? DateTime.now();
  final diff = reference.difference(value);
  if (diff.isNegative) {
    return formatBroadcastExpiry(value, now: reference);
  }
  return CitizenDateTimeFormatter.formatRelative(value, now: reference);
}

/// Labels for a future expiry timestamp (never "Just now" while Active).
String formatBroadcastExpiry(DateTime expiresAt, {DateTime? now}) {
  final presentation = BroadcastExpiryPresenter.present(
    backendStatus: "Active",
    expiresAt: expiresAt,
    now: now,
  );
  return presentation.detailLine ?? presentation.statusLabel;
}
