import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/contracts/the_eye_api_client.dart";
import "package:the_eye_mobile/emergency/active_emergency_screen.dart";
import "package:the_eye_mobile/emergency/active_emergency_service.dart";

Widget _app() {
  final apiClient = TheEyeApiClient(
    baseUrl: "https://staging-api.theeye.com.ng/v1",
  );
  return MaterialApp(
    routes: {
      "/home": (_) => const Scaffold(body: Text("Home")),
    },
    home: ActiveEmergencyScreen(
      incidentId: "",
      accessToken: "",
      service: ActiveEmergencyService(apiClient: apiClient),
      apiClient: apiClient,
    ),
  );
}

void main() {
  testWidgets("header back returns home when active emergency is root",
      (tester) async {
    await tester.pumpWidget(_app());

    await tester.tap(find.byTooltip("Back"));
    await tester.pumpAndSettle();

    expect(find.text("Home"), findsOneWidget);
  });

  testWidgets("system back returns home when active emergency is root",
      (tester) async {
    await tester.pumpWidget(_app());

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();

    expect(find.text("Home"), findsOneWidget);
  });
}
