import "dart:async";

import "package:connectivity_plus/connectivity_plus.dart";

import "connectivity_service.dart";
import "sos_service.dart";

typedef OnlineCallback = Future<void> Function();

class DeviceTelemetryService {
  DeviceTelemetryService({
    required ConnectivityService connectivity,
    this.onBackOnline,
  }) : _connectivity = connectivity;

  final ConnectivityService _connectivity;
  final OnlineCallback? onBackOnline;
  StreamSubscription<List<ConnectivityResult>>? _subscription;
  bool _wasOffline = true;

  Future<void> start() async {
    final initial = await Connectivity().checkConnectivity();
    _applyConnectivity(initial, notifyOnline: false);
    _subscription = Connectivity().onConnectivityChanged.listen(
          (results) => _applyConnectivity(results),
        );
  }

  void _applyConnectivity(List<ConnectivityResult> results,
      {bool notifyOnline = true}) {
    final hasWifi = results.contains(ConnectivityResult.wifi);
    final hasMobile = results.contains(ConnectivityResult.mobile);
    final hasEthernet = results.contains(ConnectivityResult.ethernet);
    final online = hasWifi || hasMobile || hasEthernet;

    _connectivity.update(
      wifiAvailable: hasWifi,
      lteAvailable: hasMobile,
      internetAvailable: online,
    );

    if (notifyOnline && _wasOffline && online) {
      unawaited(onBackOnline?.call());
    }
    _wasOffline = !online;
  }

  void dispose() {
    _subscription?.cancel();
  }
}

OnlineCallback watchOfflineReplay(SosService sos) {
  return () => sos.flushOfflineQueue();
}
