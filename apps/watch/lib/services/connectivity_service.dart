import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';

import '../models/connectivity_mode.dart';

typedef ConnectivityFlushCallback = FutureOr<void> Function();

/// Resolves THE EYE watch connectivity mode and optionally listens to the OS.
///
/// Without [startMonitoring], flags stay at constructor values (unit tests /
/// manual UI toggles). With monitoring, Wi-Fi / cellular / internet flags
/// update from [Connectivity] and optional [onBecameOnline] flushes the
/// offline queue.
class ConnectivityService {
  ConnectivityService({
    this.pairedPhoneAvailable = false,
    this.wifiAvailable = false,
    this.lteAvailable = false,
    this.internetAvailable = false,
    this.failoverEnabled = true,
    this.preferredMode = WatchConnectivityMode.pairedPhone,
    Connectivity? connectivity,
  }) : _connectivityPlugin = connectivity;

  bool pairedPhoneAvailable;
  bool wifiAvailable;
  bool lteAvailable;
  bool internetAvailable;
  bool failoverEnabled;
  WatchConnectivityMode preferredMode;

  final Connectivity? _connectivityPlugin;
  StreamSubscription<List<ConnectivityResult>>? _subscription;
  ConnectivityFlushCallback? _onBecameOnline;

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
    final wasOffline = activeMode == WatchConnectivityMode.offline;
    this.pairedPhoneAvailable =
        pairedPhoneAvailable ?? this.pairedPhoneAvailable;
    this.wifiAvailable = wifiAvailable ?? this.wifiAvailable;
    this.lteAvailable = lteAvailable ?? this.lteAvailable;
    this.internetAvailable = internetAvailable ?? this.internetAvailable;
    this.failoverEnabled = failoverEnabled ?? this.failoverEnabled;
    this.preferredMode = preferredMode ?? this.preferredMode;
    _notifyIfBecameOnline(wasOffline);
  }

  /// Starts OS connectivity listening. Safe to call multiple times.
  Future<void> startMonitoring({
    ConnectivityFlushCallback? onBecameOnline,
  }) async {
    _onBecameOnline = onBecameOnline ?? _onBecameOnline;
    if (_subscription != null) return;

    final plugin = _connectivityPlugin ?? Connectivity();
    try {
      final initial = await plugin.checkConnectivity();
      _applyResults(initial);
    } catch (_) {
      // Emulator / missing permission — leave flags unchanged.
    }

    _subscription = plugin.onConnectivityChanged.listen(_applyResults);
  }

  Future<void> stopMonitoring() async {
    await _subscription?.cancel();
    _subscription = null;
  }

  void _applyResults(List<ConnectivityResult> results) {
    final wasOffline = activeMode == WatchConnectivityMode.offline;
    final hasNone =
        results.isEmpty || results.every((r) => r == ConnectivityResult.none);
    final hasWifi = results.contains(ConnectivityResult.wifi);
    final hasMobile = results.contains(ConnectivityResult.mobile);
    final hasEthernet = results.contains(ConnectivityResult.ethernet);
    final hasOther = results.contains(ConnectivityResult.other);
    final online = !hasNone &&
        (hasWifi || hasMobile || hasEthernet || hasOther || results.isNotEmpty);

    wifiAvailable = hasWifi || hasEthernet;
    lteAvailable = hasMobile;
    internetAvailable = online && !hasNone;
    // Companion phone path is approximate on Wear without Wearable API:
    // treat non-cellular online as possible phone/Wi-Fi tether path.
    if (online && !hasMobile) {
      pairedPhoneAvailable = true;
    } else if (hasNone) {
      pairedPhoneAvailable = false;
    }

    _notifyIfBecameOnline(wasOffline);
  }

  void _notifyIfBecameOnline(bool wasOffline) {
    final becameOnline =
        wasOffline && activeMode != WatchConnectivityMode.offline;
    if (becameOnline && _onBecameOnline != null) {
      unawaited(Future.sync(() => _onBecameOnline!()));
    }
  }
}
