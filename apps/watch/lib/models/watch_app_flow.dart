import 'pairing_state.dart';
import 'sos_event.dart';

/// Prototype screen identifiers (22 screens from interactive prototype).
enum PrototypeScreen {
  splash,
  location,
  watchface,
  watchfaceDanger,
  notifSummary,
  notifList,
  incidentActive,
  reportCategory,
  reportDescribe,
  reportVoice,
  reportConfirm,
  sos,
  sosSent,
  map,
  stillActive,
  communityVote,
  pushCleared,
  incidentResolved,
  notifListResolved,
  settings,
  settingsRadius,
  settingsContacts,
}

/// App-level flow states (A–V) driving navigation + UI mode.
enum WatchAppFlow {
  /// A — cold start / brand splash
  idle,

  /// Pairing / onboarding required
  pairingRequired,

  /// A — location permission onboarding
  locationOnboarding,

  /// B — normal watch face
  watchFaceIdle,

  /// B — elevated area risk watch face
  watchFaceDanger,

  /// C — notification summary badge
  notificationSummary,

  /// C — scrollable alert list
  notificationList,

  /// C — active incident detail
  incidentActive,

  /// D — community report category picker
  reportCategory,

  /// D — text description step
  reportDescribe,

  /// D — voice capture step
  reportVoice,

  /// D — report confirmation
  reportConfirm,

  /// E — SOS hold + countdown
  sosCountdown,

  /// E — SOS submitting to backend
  sosSubmitting,

  /// E — SOS queued offline
  sosQueued,

  /// E — SOS sent confirmation
  sosSent,

  /// E — active emergency tracking
  sosActive,

  /// F — map / live GPS view
  mapTracking,

  /// G — resolution: still active prompt
  stillActivePrompt,

  /// G — community vote on resolution
  communityVote,

  /// G — push notification area cleared
  pushAreaCleared,

  /// G — incident resolved detail
  incidentResolved,

  /// G — notification list after resolution
  notificationListResolved,

  /// H — settings hub
  settings,

  /// H — alert radius config
  settingsRadius,

  /// H — emergency contacts
  settingsContacts,

  /// Incoming FCM critical alert overlay
  incomingAlert,

  /// Device connection diagnostics
  connectionStatus,

  /// Device health / GPS status
  deviceStatus,
}

extension WatchAppFlowX on WatchAppFlow {
  PrototypeScreen? get prototypeScreen => switch (this) {
        WatchAppFlow.idle => PrototypeScreen.splash,
        WatchAppFlow.locationOnboarding => PrototypeScreen.location,
        WatchAppFlow.watchFaceIdle => PrototypeScreen.watchface,
        WatchAppFlow.watchFaceDanger => PrototypeScreen.watchfaceDanger,
        WatchAppFlow.notificationSummary => PrototypeScreen.notifSummary,
        WatchAppFlow.notificationList => PrototypeScreen.notifList,
        WatchAppFlow.incidentActive => PrototypeScreen.incidentActive,
        WatchAppFlow.reportCategory => PrototypeScreen.reportCategory,
        WatchAppFlow.reportDescribe => PrototypeScreen.reportDescribe,
        WatchAppFlow.reportVoice => PrototypeScreen.reportVoice,
        WatchAppFlow.reportConfirm => PrototypeScreen.reportConfirm,
        WatchAppFlow.sosCountdown => PrototypeScreen.sos,
        WatchAppFlow.sosSent ||
        WatchAppFlow.sosQueued ||
        WatchAppFlow.sosSubmitting =>
          PrototypeScreen.sosSent,
        WatchAppFlow.sosActive => PrototypeScreen.sosSent,
        WatchAppFlow.mapTracking => PrototypeScreen.map,
        WatchAppFlow.stillActivePrompt => PrototypeScreen.stillActive,
        WatchAppFlow.communityVote => PrototypeScreen.communityVote,
        WatchAppFlow.pushAreaCleared => PrototypeScreen.pushCleared,
        WatchAppFlow.incidentResolved => PrototypeScreen.incidentResolved,
        WatchAppFlow.notificationListResolved =>
          PrototypeScreen.notifListResolved,
        WatchAppFlow.settings => PrototypeScreen.settings,
        WatchAppFlow.settingsRadius => PrototypeScreen.settingsRadius,
        WatchAppFlow.settingsContacts => PrototypeScreen.settingsContacts,
        _ => null,
      };

  bool get isSosFlow => switch (this) {
        WatchAppFlow.sosCountdown ||
        WatchAppFlow.sosSubmitting ||
        WatchAppFlow.sosQueued ||
        WatchAppFlow.sosSent ||
        WatchAppFlow.sosActive =>
          true,
        _ => false,
      };
}

/// Resolves the dominant app flow from pairing + SOS lifecycle signals.
WatchAppFlow resolveWatchAppFlow({
  required PairingPhase pairingPhase,
  required SosLifecycle sosLifecycle,
  bool areaDanger = false,
  bool hasIncomingAlert = false,
}) {
  if (hasIncomingAlert) return WatchAppFlow.incomingAlert;

  if (pairingPhase != PairingPhase.paired) {
    return WatchAppFlow.pairingRequired;
  }

  final sosFlow = _sosFlowFromLifecycle(sosLifecycle);
  if (sosFlow != null) return sosFlow;

  return areaDanger ? WatchAppFlow.watchFaceDanger : WatchAppFlow.watchFaceIdle;
}

WatchAppFlow? _sosFlowFromLifecycle(SosLifecycle lifecycle) {
  return switch (lifecycle) {
    SosLifecycle.holding || SosLifecycle.countdown => WatchAppFlow.sosCountdown,
    SosLifecycle.submitting => WatchAppFlow.sosSubmitting,
    SosLifecycle.active => WatchAppFlow.sosSent,
    SosLifecycle.failed => WatchAppFlow.sosQueued,
    _ => null,
  };
}

/// Allowed transitions between flows (prototype graph + service constraints).
const Map<WatchAppFlow, Set<WatchAppFlow>> watchFlowTransitions = {
  WatchAppFlow.idle: {
    WatchAppFlow.locationOnboarding,
    WatchAppFlow.pairingRequired,
    WatchAppFlow.watchFaceIdle,
  },
  WatchAppFlow.locationOnboarding: {
    WatchAppFlow.pairingRequired,
    WatchAppFlow.watchFaceIdle,
  },
  WatchAppFlow.pairingRequired: {WatchAppFlow.watchFaceIdle},
  WatchAppFlow.watchFaceIdle: {
    WatchAppFlow.watchFaceDanger,
    WatchAppFlow.notificationSummary,
    WatchAppFlow.sosCountdown,
    WatchAppFlow.mapTracking,
    WatchAppFlow.settings,
    WatchAppFlow.reportCategory,
    WatchAppFlow.incomingAlert,
  },
  WatchAppFlow.watchFaceDanger: {
    WatchAppFlow.watchFaceIdle,
    WatchAppFlow.notificationSummary,
    WatchAppFlow.sosCountdown,
  },
  WatchAppFlow.notificationSummary: {
    WatchAppFlow.notificationList,
    WatchAppFlow.sosCountdown,
    WatchAppFlow.incidentActive,
    WatchAppFlow.watchFaceIdle,
  },
  WatchAppFlow.notificationList: {
    WatchAppFlow.incidentActive,
    WatchAppFlow.stillActivePrompt,
    WatchAppFlow.watchFaceIdle,
  },
  WatchAppFlow.incidentActive: {
    WatchAppFlow.communityVote,
    WatchAppFlow.mapTracking,
    WatchAppFlow.notificationList,
  },
  WatchAppFlow.reportCategory: {
    WatchAppFlow.reportDescribe,
    WatchAppFlow.watchFaceIdle,
  },
  WatchAppFlow.reportDescribe: {
    WatchAppFlow.reportVoice,
    WatchAppFlow.reportConfirm,
    WatchAppFlow.watchFaceIdle,
  },
  WatchAppFlow.reportVoice: {WatchAppFlow.reportConfirm},
  WatchAppFlow.reportConfirm: {WatchAppFlow.watchFaceIdle},
  WatchAppFlow.sosCountdown: {
    WatchAppFlow.sosSubmitting,
    WatchAppFlow.watchFaceIdle,
  },
  WatchAppFlow.sosSubmitting: {
    WatchAppFlow.sosSent,
    WatchAppFlow.sosQueued,
  },
  WatchAppFlow.sosQueued: {
    WatchAppFlow.sosSent,
    WatchAppFlow.watchFaceIdle,
  },
  WatchAppFlow.sosSent: {
    WatchAppFlow.sosActive,
    WatchAppFlow.mapTracking,
    WatchAppFlow.watchFaceIdle,
  },
  WatchAppFlow.sosActive: {
    WatchAppFlow.mapTracking,
    WatchAppFlow.watchFaceIdle,
  },
  WatchAppFlow.mapTracking: {WatchAppFlow.watchFaceIdle},
  WatchAppFlow.stillActivePrompt: {
    WatchAppFlow.reportCategory,
    WatchAppFlow.reportDescribe,
    WatchAppFlow.communityVote,
  },
  WatchAppFlow.communityVote: {
    WatchAppFlow.pushAreaCleared,
    WatchAppFlow.incidentResolved,
  },
  WatchAppFlow.pushAreaCleared: {WatchAppFlow.incidentResolved},
  WatchAppFlow.incidentResolved: {WatchAppFlow.notificationListResolved},
  WatchAppFlow.notificationListResolved: {WatchAppFlow.watchFaceIdle},
  WatchAppFlow.settings: {
    WatchAppFlow.settingsRadius,
    WatchAppFlow.settingsContacts,
    WatchAppFlow.connectionStatus,
    WatchAppFlow.deviceStatus,
    WatchAppFlow.pairingRequired,
  },
  WatchAppFlow.settingsRadius: {WatchAppFlow.settings},
  WatchAppFlow.settingsContacts: {WatchAppFlow.settings},
  WatchAppFlow.incomingAlert: {
    WatchAppFlow.notificationSummary,
    WatchAppFlow.watchFaceIdle,
  },
  WatchAppFlow.connectionStatus: {WatchAppFlow.settings},
  WatchAppFlow.deviceStatus: {WatchAppFlow.settings},
};

bool canTransitionWatchFlow(WatchAppFlow from, WatchAppFlow to) {
  return watchFlowTransitions[from]?.contains(to) ?? false;
}
