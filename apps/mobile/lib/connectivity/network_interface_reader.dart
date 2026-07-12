import "dart:async";

import "package:connectivity_plus/connectivity_plus.dart";

abstract class NetworkInterfaceReader {
  Future<List<ConnectivityResult>> checkConnectivity();
  Stream<List<ConnectivityResult>> get onConnectivityChanged;
}

class ConnectivityPlusNetworkInterfaceReader implements NetworkInterfaceReader {
  ConnectivityPlusNetworkInterfaceReader({Connectivity? connectivity})
      : _connectivity = connectivity ?? Connectivity();

  final Connectivity _connectivity;

  @override
  Future<List<ConnectivityResult>> checkConnectivity() =>
      _connectivity.checkConnectivity();

  @override
  Stream<List<ConnectivityResult>> get onConnectivityChanged =>
      _connectivity.onConnectivityChanged;
}

class FakeNetworkInterfaceReader implements NetworkInterfaceReader {
  FakeNetworkInterfaceReader({List<ConnectivityResult>? initial}) {
    _current =
        List<ConnectivityResult>.from(initial ?? [ConnectivityResult.none]);
  }

  late List<ConnectivityResult> _current;
  final _changes = StreamController<List<ConnectivityResult>>.broadcast();

  @override
  Future<List<ConnectivityResult>> checkConnectivity() async =>
      List<ConnectivityResult>.from(_current);

  @override
  Stream<List<ConnectivityResult>> get onConnectivityChanged => _changes.stream;

  void setConnectivity(List<ConnectivityResult> results) {
    _current = List<ConnectivityResult>.from(results);
    _changes.add(_current);
  }

  void dispose() {
    _changes.close();
  }
}

bool hasActiveNetworkInterface(List<ConnectivityResult> results) {
  return results.any((result) => result != ConnectivityResult.none);
}
