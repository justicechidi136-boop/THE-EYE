import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:the_eye_mobile/brand.dart";
import "package:the_eye_mobile/main.dart";

void main() {
  testWidgets("startup shell renders branded splash before dependencies load",
      (tester) async {
    await tester.pumpWidget(const TheEyeBootstrap());
    await tester.pump();

    expect(find.byType(StartupSplashScreen), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    final scaffold = tester.widget<Scaffold>(find.byType(Scaffold).first);
    expect(scaffold.backgroundColor, BrandColors.darkBackground);

    await tester.pump(const Duration(seconds: 6));
  });
}
