String buildIncidentPublicReference({
  required String incidentId,
  required DateTime submittedAt,
}) {
  final compact = incidentId.replaceAll("-", "").toUpperCase();
  final suffix =
      compact.length >= 4 ? compact.substring(compact.length - 4) : "0000";
  final yy = (submittedAt.toUtc().year % 100).toString().padLeft(2, "0");
  final mm = submittedAt.toUtc().month.toString().padLeft(2, "0");
  final dd = submittedAt.toUtc().day.toString().padLeft(2, "0");
  return "EYE-$yy$mm$dd-$suffix";
}
