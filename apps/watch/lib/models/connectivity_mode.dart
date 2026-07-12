enum WatchConnectivityMode {
  pairedPhone('PairedPhone'),
  standaloneCellular('StandaloneCellular'),
  offline('Offline');

  const WatchConnectivityMode(this.apiValue);
  final String apiValue;

  static WatchConnectivityMode fromApi(String? value) {
    return WatchConnectivityMode.values.firstWhere(
      (mode) => mode.apiValue == value,
      orElse: () => WatchConnectivityMode.offline,
    );
  }
}
