import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('staging signing gate applies to release tasks without blocking debug', () {
    final source = File('android/app/build.gradle.kts').readAsStringSync();

    expect(source, contains('debug {'));
    expect(source, contains('signingConfig = signingConfigs.getByName("debug")'));
    expect(source, contains('selector().withBuildType("release")'));
    expect(source, contains('gradle.taskGraph.whenReady'));
    expect(source, contains('task.name.contains("StagingRelease"'));
    expect(source, contains('Watch staging release signing is not configured'));
  });
}
