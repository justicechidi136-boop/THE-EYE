import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_field_ops/launcher/launcher_modules.dart';
import 'package:the_eye_field_ops/launcher/launcher_policy.dart';
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
}
