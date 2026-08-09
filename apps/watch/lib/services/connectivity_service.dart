import '../models/connectivity_mode.dart';

class ConnectivityService {
  ConnectivityService({
    this.pairedPhoneAvailable = false,
    this.wifiAvailable = false,
    this.lteAvailable = false,
    this.internetAvailable = false,
    this.failoverEnabled = true,
    this.preferredMode = WatchConnectivityMode.pairedPhone,
    this.serverReachable = false,
    this.reachabilityGrace = const Duration(minutes: 45),
    this.unreachableFailureThreshold = 3,
    DateTime Function()? clock,
  }) : _clock = clock ?? DateTime.now;

  bool pairedPhoneAvailable;
  bool wifiAvailable;
  bool lteAvailable;
  bool internetAvailable;
  bool failoverEnabled;
  WatchConnectivityMode preferredMode;

  /// True when the watch recently reached THE EYE API (any HTTP response).
  /// Used because connectivity_plus is unreliable on some phones/Wear builds.
  bool serverReachable;

  /// Keep showing online after brief radio/API blips (doze, Wi-Fi handoff).
  final Duration reachabilityGrace;
  final int unreachableFailureThreshold;
  final DateTime Function() _clock;

  DateTime? lastServerOkAt;
  int consecutiveUnreachable = 0;

  WatchConnectivityMode get activeMode => _selectMode();

  bool get withinReachabilityGrace {
    final lastOk = lastServerOkAt;
    if (lastOk == null) return false;
    return _clock().difference(lastOk) < reachabilityGrace;
  }

  bool get effectivelyOnline =>
      internetAvailable || serverReachable || withinReachabilityGrace;

  WatchConnectivityMode _selectMode() {
    if (!effectivelyOnline) {
      return WatchConnectivityMode.offline;
    }

    if (preferredMode == WatchConnectivityMode.standaloneCellular &&
        (lteAvailable || wifiAvailable || serverReachable || withinReachabilityGrace)) {
      return WatchConnectivityMode.standaloneCellular;
    }

    if (pairedPhoneAvailable) {
      return WatchConnectivityMode.pairedPhone;
    }

    if (failoverEnabled && lteAvailable) {
      return WatchConnectivityMode.standaloneCellular;
    }

    if (wifiAvailable || serverReachable || withinReachabilityGrace) {
      return preferredMode == WatchConnectivityMode.standaloneCellular
          ? WatchConnectivityMode.standaloneCellular
          : WatchConnectivityMode.pairedPhone;
    }

    return WatchConnectivityMode.offline;
  }

  void update({
    bool? pairedPhoneAvailable,
    bool? wifiAvailable,
    bool? lteAvailable,
    bool? internetAvailable,
    bool? failoverEnabled,
    WatchConnectivityMode? preferredMode,
    bool? serverReachable,
  }) {
    this.pairedPhoneAvailable =
        pairedPhoneAvailable ?? this.pairedPhoneAvailable;
    this.wifiAvailable = wifiAvailable ?? this.wifiAvailable;
    this.lteAvailable = lteAvailable ?? this.lteAvailable;
    this.internetAvailable = internetAvailable ?? this.internetAvailable;
    this.failoverEnabled = failoverEnabled ?? this.failoverEnabled;
    this.preferredMode = preferredMode ?? this.preferredMode;
    this.serverReachable = serverReachable ?? this.serverReachable;
  }

  /// Call after standalone activation or any successful API round-trip.
  void markServerReachable({WatchConnectivityMode? preferredMode}) {
    serverReachable = true;
    internetAvailable = true;
    consecutiveUnreachable = 0;
    lastServerOkAt = _clock();
    if (preferredMode != null) {
      this.preferredMode = preferredMode;
    }
    if (this.preferredMode == WatchConnectivityMode.standaloneCellular) {
      if (!lteAvailable && !wifiAvailable) {
        // Phone/emulator often has Wi-Fi even when radio APIs report none.
        wifiAvailable = true;
      }
    }
  }

  /// Note a transport failure. Does not flip Offline on the first blip.
  void markServerUnreachable() {
    consecutiveUnreachable += 1;
    if (consecutiveUnreachable < unreachableFailureThreshold ||
        withinReachabilityGrace) {
      // Keep sticky online through doze / single timeouts.
      return;
    }
    serverReachable = false;
    internetAvailable = false;
  }

  void configureStandaloneOnline() {
    markServerReachable(
      preferredMode: WatchConnectivityMode.standaloneCellular,
    );
  }
}
