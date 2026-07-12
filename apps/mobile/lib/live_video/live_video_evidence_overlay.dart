class LiveVideoEvidenceOverlay {
  const LiveVideoEvidenceOverlay({
    required this.title,
    required this.incidentId,
    required this.date,
    required this.time,
    required this.gps,
    required this.accuracy,
    required this.reporter,
    required this.sessionId,
    required this.connectionStatus,
  });

  final String title;
  final String incidentId;
  final String date;
  final String time;
  final String gps;
  final String accuracy;
  final String reporter;
  final String sessionId;
  final String connectionStatus;

  factory LiveVideoEvidenceOverlay.fromApi(
    Map<String, dynamic>? raw, {
    required String connectionStatus,
    String? fallbackIncidentId,
    String? fallbackSessionId,
  }) {
    final overlay = raw ?? const <String, dynamic>{};
    return LiveVideoEvidenceOverlay(
      title: overlay["title"] as String? ?? "THE EYE LIVE EVIDENCE",
      incidentId: overlay["incidentId"] as String? ?? fallbackIncidentId ?? "-",
      date: overlay["date"] as String? ?? "-",
      time: overlay["time"] as String? ?? "-",
      gps: overlay["gps"] as String? ?? "Waiting for GPS",
      accuracy: overlay["accuracy"] as String? ?? "Unknown",
      reporter: overlay["reporter"] as String? ?? "Unknown",
      sessionId: overlay["sessionId"] as String? ?? fallbackSessionId ?? "-",
      connectionStatus: connectionStatus,
    );
  }

  LiveVideoEvidenceOverlay copyWithFallbackGps(
      {required String gps, required String accuracy, String? time}) {
    return LiveVideoEvidenceOverlay(
      title: title,
      incidentId: incidentId,
      date: date,
      time: time ?? this.time,
      gps: gps,
      accuracy: accuracy,
      reporter: reporter,
      sessionId: sessionId,
      connectionStatus: connectionStatus,
    );
  }
}
