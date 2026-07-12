enum ConnectivityState {
  online,
  offline,
  reconnecting,
  limited,
}

extension ConnectivityStateLabels on ConnectivityState {
  String get statusLabel {
    switch (this) {
      case ConnectivityState.online:
        return "Connected to THE EYE";
      case ConnectivityState.offline:
        return "No network connection";
      case ConnectivityState.reconnecting:
        return "Reconnecting to THE EYE";
      case ConnectivityState.limited:
        return "THE EYE servers unreachable";
    }
  }

  String get bannerMessage {
    switch (this) {
      case ConnectivityState.online:
        return "";
      case ConnectivityState.offline:
        return "You are offline. Reports are saved as drafts and will send when internet returns.";
      case ConnectivityState.reconnecting:
        return "Reconnecting... Saved reports will send automatically once THE EYE is reachable.";
      case ConnectivityState.limited:
        return "Network is active but THE EYE servers are unreachable. Reports are saved and will retry automatically.";
    }
  }

  bool get showConnectivityBanner => this != ConnectivityState.online;
}
