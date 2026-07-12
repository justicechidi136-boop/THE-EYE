enum EvidencePermissionState {
  notRequested,
  granted,
  denied,
  permanentlyDenied,
  restricted,
}

extension EvidencePermissionStateLabels on EvidencePermissionState {
  String get rationaleTitle {
    switch (this) {
      case EvidencePermissionState.granted:
        return "Camera access enabled";
      default:
        return "Camera access needed for evidence";
    }
  }

  bool get canCapture => this == EvidencePermissionState.granted;
  bool get shouldShowSettingsLink =>
      this == EvidencePermissionState.permanentlyDenied ||
      this == EvidencePermissionState.restricted;
}

const evidencePermissionRationale =
    "THE EYE needs camera, microphone, and photo library access so you can attach timestamped photos and videos to incident reports. "
    "Evidence helps responders verify what happened. We only access media you choose to attach.";
