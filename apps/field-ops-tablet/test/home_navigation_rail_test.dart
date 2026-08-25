import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('extended home navigation rail uses a compatible label mode', () {
    final source = File('lib/screens/home_screen.dart').readAsStringSync();

    expect(source, contains('extended: true'));
    expect(source, contains('scrollable: true'));
    expect(source, contains('labelType: NavigationRailLabelType.none'));
    expect(source, isNot(contains('labelType: NavigationRailLabelType.all')));
    expect(source, contains('FieldRoutes.broadcasts'));
    expect(source, contains('Icons.campaign_outlined'));
    expect(source, contains('FieldBrandingAssets.logoUi'));
    expect(source, isNot(contains('Icons.shield')));
  });
}
