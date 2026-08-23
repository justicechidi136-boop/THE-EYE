import "package:flutter/material.dart";

import "../design_system/eye_semantic_colors.dart";
import "../presentation/citizen_date_time.dart";

class CitizenLocationDetails extends StatelessWidget {
  const CitizenLocationDetails({
    this.address,
    this.secondaryLocation,
    this.accuracyMeters,
    this.capturedAt,
    this.title = "Location",
    this.compact = false,
    super.key,
  });

  final String? address;
  final String? secondaryLocation;
  final double? accuracyMeters;
  final DateTime? capturedAt;
  final String title;
  final bool compact;

  List<String> get _locationLines {
    final lines = <String>[];
    for (final candidate in [address, secondaryLocation]) {
      for (final raw in (candidate ?? "").split(RegExp(r"[\r\n]+"))) {
        final value = raw.trim();
        if (value.isNotEmpty &&
            !lines.any((line) => line.toLowerCase() == value.toLowerCase())) {
          lines.add(value);
        }
      }
    }
    return lines;
  }

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    final lines = _locationLines;
    return Column(
      key: const ValueKey("citizen-location-details"),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (!compact)
          Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
        if (!compact) const SizedBox(height: 4),
        Text(
          lines.isEmpty ? "Location unavailable" : lines.join("\n"),
          style: TextStyle(
            color: colors.bodyText,
            fontWeight: FontWeight.w600,
          ),
        ),
        if (accuracyMeters != null) ...[
          const SizedBox(height: 4),
          Text(
            "GPS accuracy: ${accuracyMeters!.round()} m",
            style: TextStyle(color: colors.mutedText),
          ),
        ],
        if (capturedAt != null) ...[
          const SizedBox(height: 2),
          Text(
            "Captured: ${CitizenDateTimeFormatter.formatDateTime(capturedAt!)}",
            style: TextStyle(color: colors.mutedText),
          ),
        ],
      ],
    );
  }
}

double? locationAccuracyFromMetadata(Object? metadata) {
  if (metadata is! Map) return null;
  final value =
      metadata["locationAccuracyMeters"] ?? metadata["accuracyMeters"];
  return value is num
      ? value.toDouble()
      : double.tryParse(value?.toString() ?? "");
}
