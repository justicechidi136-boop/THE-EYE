import '../models/connectivity_mode.dart';

class ConnectivityService {
  ConnectivityService({
    this.pairedPhoneAvailable = false,
    this.wifiAvailable = false,
    this.lteAvailable = false,
    this.internetAvailable = false,
    this.failoverEnabled = true,
    this.preferredMode = WatchConnectivityMode.pairedPhone,
  });

  bool pairedPhoneAvailable;
  bool wifiAvailable;
  bool lteAvailable;
  bool internetAvailable;
  bool failoverEnabled;
  WatchConnectivityMode preferredMode;

  WatchConnectivityMode get activeMode => _selectMode();

  WatchConnectivityMode _selectMode() {
    if (preferredMode == WatchConnectivityMode.standaloneCellular &&
        lteAvailable &&
        internetAvailable) {
      return WatchConnectivityMode.standaloneCellular;
    }

    if (pairedPhoneAvailable && internetAvailable) {
      return WatchConnectivityMode.pairedPhone;
    }

    if (failoverEnabled && lteAvailable && internetAvailable) {
      return WatchConnectivityMode.standaloneCellular;
    }

    if (wifiAvailable && internetAvailable) {
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
  }) {
    this.pairedPhoneAvailable =
        pairedPhoneAvailable ?? this.pairedPhoneAvailable;
    this.wifiAvailable = wifiAvailable ?? this.wifiAvailable;
    this.lteAvailable = lteAvailable ?? this.lteAvailable;
    this.internetAvailable = internetAvailable ?? this.internetAvailable;
    this.failoverEnabled = failoverEnabled ?? this.failoverEnabled;
    this.preferredMode = preferredMode ?? this.preferredMode;
  }
}
