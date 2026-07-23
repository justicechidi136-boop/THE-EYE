import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_watch/services/version_compatibility_service.dart';

void main() {
  test('semver comparison orders versions correctly', () {
    expect(VersionCompatibilityService.compareSemver('0.1.0', '0.1.0'), 0);
    expect(VersionCompatibilityService.compareSemver('0.2.0', '0.1.9'), greaterThan(0));
    expect(VersionCompatibilityService.compareSemver('0.1.0', '1.0.0'), lessThan(0));
  });

  test('malformed version policy falls back to supported', () {
    final policy = VersionCompatibilityPolicy.fromApi({});
    expect(policy.updateStatus, VersionUpdateStatus.supported);
  });
}
