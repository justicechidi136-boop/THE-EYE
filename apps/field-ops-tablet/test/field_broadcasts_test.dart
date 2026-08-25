import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_field_ops/launcher/launcher_modules.dart';
import 'package:the_eye_field_ops/launcher/launcher_policy.dart';
import 'package:the_eye_field_ops/l10n/generated/field_localizations.dart';
import 'package:the_eye_field_ops/screens/broadcasts/broadcasts_screen.dart';
import 'package:the_eye_field_ops/screens/routes.dart';

void main() {
  test('parses the canonical country feed response safely', () {
    final item = FieldBroadcastItem.fromJson({
      'id': 'broadcast-1',
      'type': 'MissingPerson',
      'title': 'Missing person alert',
      'body': 'Please remain observant.',
      'priority': 'P2Urgent',
      'status': 'Published',
      'publishedAt': '2026-08-25T20:00:00.000Z',
      'country': 'Nigeria',
    });

    expect(item.id, 'broadcast-1');
    expect(item.type, 'MissingPerson');
    expect(item.publishedAt, isNotNull);
    expect(item.country, 'Nigeria');
  });

  test('broadcast launcher module uses its dedicated route', () {
    final module = LauncherModules.all.singleWhere(
      (item) => item.id == 'broadcasts',
    );
    expect(module.route, FieldRoutes.broadcasts);
  });

  test('broadcasts are visible to every operational launcher role', () {
    for (final role in [
      'officer',
      'patrol',
      'checkpoint',
      'drone',
      'supervisor',
      'commander',
    ]) {
      expect(
        LauncherPolicy.modulesForRole(role),
        contains('broadcasts'),
        reason: 'missing Broadcasts for $role',
      );
    }
  });

  testWidgets('shows full vehicle identifiers and every evidence type', (
    tester,
  ) async {
    final item = FieldBroadcastItem.fromJson({
      'id': 'broadcast-vehicle',
      'type': 'StolenVehicle',
      'title': 'Stolen vehicle',
      'body': 'Watch for this vehicle.',
      'priority': 'P2ActiveCrimeAccident',
      'status': 'Published',
      'metadata': {
        'make': 'Toyota',
        'model': 'Camry',
        'registrationNumber': 'LAG-123-XY',
        'registrationMasked': '*****3-XY',
        'vin': '1HGCM82633A004352',
        'vinLastFour': '4352',
        'vehiclePhotos': [
          {
            'id': 'photo-1',
            'mediaType': 'image',
            'objectKey': 'evidence/vehicle/photo.jpg',
          },
        ],
        'attachments': [
          {
            'id': 'video-1',
            'mediaType': 'video',
            'objectKey': 'evidence/vehicle/video.mp4',
          },
          {
            'id': 'audio-1',
            'mediaType': 'audio',
            'objectKey': 'evidence/vehicle/audio.m4a',
          },
        ],
      },
    });

    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: FieldLocalizations.localizationsDelegates,
        supportedLocales: FieldLocalizations.supportedLocales,
        home: Scaffold(body: FieldBroadcastDetails(item: item)),
      ),
    );

    expect(find.text('LAG-123-XY'), findsOneWidget);
    expect(find.text('1HGCM82633A004352'), findsOneWidget);
    expect(find.text('*****3-XY'), findsNothing);
    expect(find.text('Photo evidence'), findsOneWidget);
    expect(find.text('Video evidence'), findsOneWidget);
    expect(find.text('Audio evidence'), findsOneWidget);
  });

  testWidgets('shows complete missing-person information', (tester) async {
    final item = FieldBroadcastItem.fromJson({
      'id': 'broadcast-missing',
      'type': 'MissingPerson',
      'title': 'Missing person',
      'body': 'Please remain observant.',
      'priority': 'P2ActiveCrimeAccident',
      'status': 'Published',
      'metadata': {
        'fullName': 'Ada Okeke',
        'ageOrApproximateAge': '12',
        'lastSeenAddress': 'Allen Avenue, Ikeja',
        'clothingDescription': 'Blue shirt and black trousers',
      },
    });

    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: FieldLocalizations.localizationsDelegates,
        supportedLocales: FieldLocalizations.supportedLocales,
        home: Scaffold(body: FieldBroadcastDetails(item: item)),
      ),
    );

    expect(find.text('Ada Okeke'), findsOneWidget);
    expect(find.text('12'), findsOneWidget);
    expect(find.text('Allen Avenue, Ikeja'), findsOneWidget);
    expect(find.text('Blue shirt and black trousers'), findsOneWidget);
  });

  testWidgets('lays out broadcast details inside a tablet dialog', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(1280, 800));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final item = FieldBroadcastItem.fromJson({
      'id': 'broadcast-dialog',
      'type': 'StolenVehicle',
      'title': 'Stolen vehicle',
      'body': 'Watch for this vehicle.',
      'priority': 'P2ActiveCrimeAccident',
      'status': 'Published',
      'metadata': {
        'registrationNumber': 'LAG-123-XY',
        'vin': '1HGCM82633A004352',
      },
    });

    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: FieldLocalizations.localizationsDelegates,
        supportedLocales: FieldLocalizations.supportedLocales,
        home: Scaffold(
          body: Builder(
            builder:
                (context) => Center(
                  child: FilledButton(
                    onPressed:
                        () => showDialog<void>(
                          context: context,
                          builder:
                              (context) => AlertDialog(
                                content: ConstrainedBox(
                                  constraints: const BoxConstraints(
                                    maxWidth: 620,
                                  ),
                                  child: SingleChildScrollView(
                                    child: FieldBroadcastDetails(item: item),
                                  ),
                                ),
                              ),
                        ),
                    child: const Text('Open details'),
                  ),
                ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open details'));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.text('LAG-123-XY'), findsOneWidget);
    expect(find.text('1HGCM82633A004352'), findsOneWidget);
  });
}
