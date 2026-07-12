import "dart:async";

import "package:connectivity_plus/connectivity_plus.dart";
import "package:flutter/foundation.dart";

import "../contracts/the_eye_api_client.dart";
import "connectivity_state.dart";
import "network_interface_reader.dart";

class ConnectivityService extends ChangeNotifier {
  ConnectivityService({
    required TheEyeApiClient apiClient,
    required NetworkInterfaceReader networkReader,
    this.probeTimeout = const Duration(seconds: 5),
    this.debounceDelay = const Duration(milliseconds: 400),
  })  : _apiClient = apiClient,
        _networkReader = networkReader;

  final TheEyeApiClient _apiClient;
  final NetworkInterfaceReader _networkReader;
  final Duration probeTimeout;
  final Duration debounceDelay;

  ConnectivityState _state = ConnectivityState.reconnecting;
  StreamSubscription<List<ConnectivityResult>>? _subscription;
  Timer? _debounceTimer;
  int _probeGeneration = 0;
  bool _disposed = false;

  ConnectivityState get state => _state;
  bool get isOnline => _state == ConnectivityState.online;
  bool get canSubmitToApi => isOnline;
  bool get showConnectivityBanner => _state.showConnectivityBanner;

  Future<void> initialize() async {
    await _evaluateConnectivity(immediate: true);
    _subscription = _networkReader.onConnectivityChanged.listen((_) {
      _scheduleEvaluation();
    });
  }

  Future<void> refresh() => _evaluateConnectivity(immediate: true);

  void _scheduleEvaluation() {
    _debounceTimer?.cancel();
    _debounceTimer = Timer(debounceDelay, () {
      unawaited(_evaluateConnectivity());
    });
  }

  Future<void> _evaluateConnectivity({bool immediate = false}) async {
    final generation = ++_probeGeneration;
    final interfaces = await _networkReader.checkConnectivity();
    if (_disposed || generation != _probeGeneration) return;

    if (!hasActiveNetworkInterface(interfaces)) {
      _setState(ConnectivityState.offline);
      return;
    }

    if (!immediate && _state == ConnectivityState.offline) {
      _setState(ConnectivityState.reconnecting);
    } else if (_state != ConnectivityState.online) {
      _setState(ConnectivityState.reconnecting);
    }

    final reachable = await _apiClient.checkApiReachable(timeout: probeTimeout);
    if (_disposed || generation != _probeGeneration) return;

    _setState(reachable ? ConnectivityState.online : ConnectivityState.limited);
  }

  void _setState(ConnectivityState next) {
    if (_state == next) return;
    _state = next;
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _debounceTimer?.cancel();
    _subscription?.cancel();
    super.dispose();
  }
}
