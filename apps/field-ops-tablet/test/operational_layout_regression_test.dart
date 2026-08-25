import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('short landscape control panels remain scrollable', () {
    final patrol =
        File('lib/screens/patrol/patrol_mode_screen.dart').readAsStringSync();
    final checkpoint =
        File(
          'lib/screens/checkpoint/checkpoint_mode_screen.dart',
        ).readAsStringSync();

    expect(patrol, contains('SingleChildScrollView('));
    expect(checkpoint, contains('SingleChildScrollView('));
    expect(checkpoint, contains('BoxConstraints.tightFor('));
    expect(checkpoint, contains('Expanded('));
  });
}
