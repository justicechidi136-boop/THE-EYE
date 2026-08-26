import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:the_eye_watch/api/watch_api_client.dart';
import 'package:the_eye_watch/models/watch_area_risk.dart';
import 'package:the_eye_watch/services/area_risk_service.dart';
import 'package:the_eye_watch/services/connectivity_service.dart';
import 'package:the_eye_watch/services/location_service.dart';
import 'package:the_eye_watch/storage/secure_credential_store.dart';

class _RiskApiClient extends WatchApiClient {
  _RiskApiClient({required this.response})
      : super(skipEnvGuard: true, baseUrl: 'http://127.0.0.1:4000/v1');

  final Map<String, dynamic> response;
  String? requestedPath;

  @override
  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, String>? headers,
  }) async {
    requestedPath = path;
    return response;
  }
}

Position _position() => Position(
      latitude: 6.5244,
      longitude: 3.3792,
      timestamp: DateTime.now(),
      accuracy: 8,
      altitude: 0,
      altitudeAccuracy: 0,
      heading: 0,
      headingAccuracy: 0,
      speed: 0,
      speedAccuracy: 0,
    );

void main() {
  test('maps backend area risk to the watch status', () async {
    final credentials = SecureCredentialStore(memory: <String, String>{});
    await credentials.saveAccessToken('watch-access-token');
    final api = _RiskApiClient(response: {
      'data': {
        'level': 'HIGH_RISK',
        'eventCount': 6,
        'windowDays': 30,
        'radiusMeters': 4000,
        'approximateArea': 'Ikeja',
        'evaluatedAt': '2026-08-26T12:00:00.000Z',
      },
    });
    final location = LocationService(
      api: api,
      credentials: credentials,
      preferences: PreferencesStore(),
      connectivity: ConnectivityService(),
      positionProvider: () async => _position(),
    );
    final service = AreaRiskService(
      api: api,
      credentials: credentials,
      location: location,
    );

    await service.refresh();

    expect(service.status.value.level, WatchAreaRiskLevel.highRisk);
    expect(service.status.value.eventCount, 6);
    expect(service.status.value.approximateArea, 'Ikeja');
    expect(api.requestedPath, contains('/danger-triggers/area-risk?'));
    service.dispose();
  });

  test('supports green, medium, and high risk response levels', () {
    expect(
      WatchAreaRiskStatus.fromJson({}).level,
      WatchAreaRiskLevel.unknown,
    );
    expect(
      WatchAreaRiskStatus.fromJson({'level': 'GREEN_SAFE'}).level,
      WatchAreaRiskLevel.greenSafe,
    );
    expect(
      WatchAreaRiskStatus.fromJson({'level': 'MEDIUM_RISK'}).level,
      WatchAreaRiskLevel.mediumRisk,
    );
    expect(
      WatchAreaRiskStatus.fromJson({'level': 'HIGH_RISK'}).level,
      WatchAreaRiskLevel.highRisk,
    );
  });
}
