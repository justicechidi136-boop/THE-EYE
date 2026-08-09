import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_watch/models/connectivity_mode.dart';
import 'package:the_eye_watch/services/connectivity_service.dart';

void main() {
  test('failover selects LTE when phone unavailable', () {
    final service = ConnectivityService(
      pairedPhoneAvailable: false,
      lteAvailable: true,
      internetAvailable: true,
      failoverEnabled: true,
      preferredMode: WatchConnectivityMode.pairedPhone,
    );

    expect(service.activeMode, WatchConnectivityMode.standaloneCellular);
  });

  test('paired phone preferred when available', () {
    final service = ConnectivityService(
      pairedPhoneAvailable: true,
      internetAvailable: true,
      preferredMode: WatchConnectivityMode.pairedPhone,
    );

    expect(service.activeMode, WatchConnectivityMode.pairedPhone);
  });

  test('offline when no connectivity paths', () {
    final service = ConnectivityService(
      pairedPhoneAvailable: false,
      wifiAvailable: false,
      lteAvailable: false,
      internetAvailable: false,
    );

    expect(service.activeMode, WatchConnectivityMode.offline);
  });

  test('server reachability marks standalone online without radio APIs', () {
    final service = ConnectivityService(
      pairedPhoneAvailable: false,
      wifiAvailable: false,
      lteAvailable: false,
      internetAvailable: false,
    );

    service.configureStandaloneOnline();

    expect(service.activeMode, WatchConnectivityMode.standaloneCellular);
    expect(service.internetAvailable, isTrue);
    expect(service.serverReachable, isTrue);
  });

  test('single unreachable blip stays online inside grace window', () {
    var now = DateTime(2026, 8, 9, 12);
    final service = ConnectivityService(
      clock: () => now,
      reachabilityGrace: const Duration(minutes: 45),
      unreachableFailureThreshold: 3,
    );

    service.configureStandaloneOnline();
    service.markServerUnreachable();
    service.markServerUnreachable();

    expect(service.activeMode, WatchConnectivityMode.standaloneCellular);
    expect(service.serverReachable, isTrue);
  });

  test('offline only after grace expires and repeated failures', () {
    var now = DateTime(2026, 8, 9, 12);
    final service = ConnectivityService(
      clock: () => now,
      reachabilityGrace: const Duration(minutes: 45),
      unreachableFailureThreshold: 3,
    );

    service.configureStandaloneOnline();
    now = now.add(const Duration(minutes: 50));
    service.markServerUnreachable();
    service.markServerUnreachable();
    service.markServerUnreachable();

    expect(service.serverReachable, isFalse);
    expect(service.activeMode, WatchConnectivityMode.offline);
  });
}
