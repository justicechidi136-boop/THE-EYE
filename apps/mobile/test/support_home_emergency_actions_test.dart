import "dart:io";

import "package:flutter_test/flutter_test.dart";

void main() {
  test("Help emergency actions use canonical application flows", () {
    final supportSource =
        File("lib/support/support_home_screen.dart").readAsStringSync();
    final appSource = File("lib/main.dart").readAsStringSync();

    expect(supportSource, contains("onTap: onSendSos"));
    expect(supportSource, contains("onTap: onOpenActiveEmergency"));
    expect(supportSource, isNot(contains('pushNamed("/report/emergency")')));
    expect(appSource, contains("onSendSos: () => _openSos(context)"));
    expect(appSource, contains("ActiveEmergencyNavigation.open("));
  });
}
