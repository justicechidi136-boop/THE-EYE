import "the_eye_enums.dart";

/// UI report routes mapped to canonical `IncidentType` API values.
enum ReportType {
  emergency,
  crime,
  accident,
  fire,
  kidnapping,
  abuse,
  suspiciousActivity
}

extension ReportTypeContract on ReportType {
  String get incidentType {
    switch (this) {
      case ReportType.emergency:
        return IncidentType.emergency;
      case ReportType.crime:
        return IncidentType.crime;
      case ReportType.accident:
        return IncidentType.accident;
      case ReportType.fire:
        return IncidentType.fire;
      case ReportType.kidnapping:
        return IncidentType.kidnapping;
      case ReportType.abuse:
        return IncidentType.abuse;
      case ReportType.suspiciousActivity:
        return IncidentType.suspiciousActivity;
    }
  }

  String get label {
    switch (this) {
      case ReportType.emergency:
        return "Emergency";
      case ReportType.crime:
        return "Crime";
      case ReportType.accident:
        return "Accident";
      case ReportType.fire:
        return "Fire";
      case ReportType.kidnapping:
        return "Kidnapping";
      case ReportType.abuse:
        return "Abuse";
      case ReportType.suspiciousActivity:
        return "Suspicious activity";
    }
  }

  /// Figma screen titles (`286:188`, `712:3265`, etc.).
  String get figmaTitle {
    switch (this) {
      case ReportType.emergency:
        return "Emergency Case";
      case ReportType.crime:
        return "Report Crime";
      case ReportType.accident:
        return "Accident Reporting";
      case ReportType.fire:
        return "Fire Report";
      case ReportType.kidnapping:
        return "Kidnapping Report";
      case ReportType.abuse:
        return "Abuse Report";
      case ReportType.suspiciousActivity:
        return "Suspicious Activity";
    }
  }
}
