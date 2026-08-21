import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/contracts/the_eye_api_client.dart";
import "package:the_eye_mobile/emergency/active_emergency_contract.dart";
import "package:the_eye_mobile/emergency/active_emergency_navigation.dart";
import "package:the_eye_mobile/emergency/active_emergency_screen.dart";
import "package:the_eye_mobile/emergency/active_emergency_service.dart";

ActiveEmergencyScreen _activeEmergencyScreen() {
  final apiClient = TheEyeApiClient(
    baseUrl: "https://staging-api.theeye.com.ng/v1",
  );
  return ActiveEmergencyScreen(
    incidentId: "",
    accessToken: "",
    service: ActiveEmergencyService(apiClient: apiClient),
    apiClient: apiClient,
  );
}

Widget _rootApp({NavigatorObserver? observer}) {
  return MaterialApp(
    navigatorObservers: [if (observer != null) observer],
    routes: {
      "/home": (_) => const Scaffold(body: Text("Home")),
    },
    home: _activeEmergencyScreen(),
  );
}

Widget _stackedApp(_CountingNavigatorObserver observer) {
  return MaterialApp(
    navigatorObservers: [observer],
    routes: {
      "/home": (_) => const Scaffold(body: Text("Home")),
    },
    home: Builder(
      builder: (context) => Scaffold(
        body: Column(
          children: [
            const Text("Previous route"),
            FilledButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => _activeEmergencyScreen(),
                ),
              ),
              child: const Text("Open active emergency"),
            ),
          ],
        ),
      ),
    ),
  );
}

class _CountingNavigatorObserver extends NavigatorObserver {
  int popCount = 0;
  int replaceCount = 0;

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    popCount += 1;
    super.didPop(route, previousRoute);
  }

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) {
    replaceCount += 1;
    super.didReplace(newRoute: newRoute, oldRoute: oldRoute);
  }
}

void main() {
  testWidgets("header back returns home when active emergency is root",
      (tester) async {
    await tester.pumpWidget(_rootApp());

    await tester.tap(find.byTooltip("Back"));
    await tester.pumpAndSettle();

    expect(find.text("Home"), findsOneWidget);
    expect(find.text("Active Emergency"), findsNothing);
  });

  testWidgets("system back returns home when active emergency is root",
      (tester) async {
    await tester.pumpWidget(_rootApp());

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();

    expect(find.text("Home"), findsOneWidget);
    expect(find.text("Active Emergency"), findsNothing);
  });

  testWidgets("header back returns to the exact previous route once",
      (tester) async {
    final observer = _CountingNavigatorObserver();
    await tester.pumpWidget(_stackedApp(observer));
    await tester.tap(find.text("Open active emergency"));
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip("Back"));
    expect(find.text("Home"), findsNothing);
    await tester.pumpAndSettle();

    expect(find.text("Previous route"), findsOneWidget);
    expect(find.text("Home"), findsNothing);
    expect(observer.popCount, 1);
    expect(observer.replaceCount, 0);
  });

  testWidgets("system back returns to the exact previous route once",
      (tester) async {
    final observer = _CountingNavigatorObserver();
    await tester.pumpWidget(_stackedApp(observer));
    await tester.tap(find.text("Open active emergency"));
    await tester.pumpAndSettle();

    await tester.binding.handlePopRoute();
    expect(find.text("Home"), findsNothing);
    await tester.pumpAndSettle();

    expect(find.text("Previous route"), findsOneWidget);
    expect(find.text("Home"), findsNothing);
    expect(observer.popCount, 1);
    expect(observer.replaceCount, 0);
  });

  testWidgets("terminal contract still routes to incident detail",
      (tester) async {
    const terminal = ActiveEmergencyTerminalContract(
      incidentId: "incident-123",
      status: "Resolved",
      displayLabel: "Emergency resolved",
      statusVersion: 2,
      routeType: "INCIDENT_DETAILS",
    );
    await tester.pumpWidget(
      MaterialApp(
        routes: {
          "/incident-detail": (_) => const Scaffold(
                body: Text("Incident detail"),
              ),
        },
        home: Builder(
          builder: (context) => Scaffold(
            body: FilledButton(
              onPressed: () async {
                await ActiveEmergencyNavigation.handleTerminalContract(
                  context,
                  terminal,
                  delay: Duration.zero,
                );
              },
              child: const Text("Resolve emergency"),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text("Resolve emergency"));
    await tester.pumpAndSettle();

    expect(find.text("Incident detail"), findsOneWidget);
  });
}
