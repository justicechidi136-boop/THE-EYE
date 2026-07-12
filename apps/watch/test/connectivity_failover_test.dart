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
}
