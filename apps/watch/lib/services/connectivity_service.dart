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
  });

  bool pairedPhoneAvailable;
  bool wifiAvailable;
  bool lteAvailable;
  bool internetAvailable;
  bool failoverEnabled;
  WatchConnectivityMode preferredMode;

  /// True when the watch recently reached THE EYE API (any HTTP response).
  /// Used because connectivity_plus is unreliable on some phones/Wear builds.
  bool serverReachable;

  WatchConnectivityMode get activeMode => _selectMode();

  bool get _effectivelyOnline => internetAvailable || serverReachable;

  WatchConnectivityMode _selectMode() {
    if (!_effectivelyOnline) {
      return WatchConnectivityMode.offline;
    }

    if (preferredMode == WatchConnectivityMode.standaloneCellular &&
        (lteAvailable || wifiAvailable || serverReachable)) {
      return WatchConnectivityMode.standaloneCellular;
    }

    if (pairedPhoneAvailable) {
      return WatchConnectivityMode.pairedPhone;
    }

    if (failoverEnabled && lteAvailable) {
      return WatchConnectivityMode.standaloneCellular;
    }

    if (wifiAvailable || serverReachable) {
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

  void markServerUnreachable() {
    serverReachable = false;
  }

  void configureStandaloneOnline() {
    markServerReachable(
      preferredMode: WatchConnectivityMode.standaloneCellular,
    );
  }
}
