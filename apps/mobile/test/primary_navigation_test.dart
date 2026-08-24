import "dart:io";

import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/design_system/components/eye_bottom_nav.dart";
import "package:the_eye_mobile/neighborhood_watch/neighborhood_watch_prototype_chrome.dart";

void main() {
  testWidgets("primary navigation replaces Services with local Feed",
      (tester) async {
    int? selected;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          bottomNavigationBar: EyeBottomNav(
            selectedIndex: 0,
            onTabSelected: (index) => selected = index,
            onEyePressed: () {},
          ),
        ),
      ),
    );

    expect(find.text("Services"), findsNothing);
    expect(find.text("Feed"), findsOneWidget);
    await tester.tap(find.text("Feed"));
    expect(selected, 1);
  });

  test("navigation selection treats Tracking as Home and NW as Feed", () {
    expect(EyeNavRoutes.selectedIndexForRoute("/tracking"), 0);
    expect(
      EyeNavRoutes.selectedIndexForRoute("/neighborhood-watch/feed"),
      1,
    );
  });

  test("Home owns Tracking and the Services screen is removed", () {
    final mainSource = File("lib/main.dart").readAsStringSync();
    expect(mainSource, contains('title: "Incident Tracking"'));
    expect(mainSource, isNot(contains("class ServicesHubScreen")));
    expect(mainSource, isNot(contains('"/services":')));
  });

  test("Feed shortcut resolves an authorized geographic room first", () {
    final homeSource =
        File("lib/neighborhood_watch/nw_home_screen.dart").readAsStringSync();
    expect(homeSource, contains('arguments["openFeed"] == true'));
    expect(homeSource, contains("hasAuthorizedRoom"));
    expect(
      homeSource,
      contains("pushReplacementNamed(NeighborhoodWatchDestinations.feed)"),
    );
  });

  testWidgets("Neighborhood Watch Home intercepts Android back",
      (tester) async {
    var backCalls = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: NwPrototypeScaffold(
          title: "Neighborhood Watch",
          body: const SizedBox.expand(),
          onBack: () => backCalls += 1,
        ),
      ),
    );

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();

    expect(backCalls, 1);
    expect(find.byTooltip("Back to app home"), findsOneWidget);
  });

  test("Neighborhood Watch Home routes back to app Home", () {
    final homeSource =
        File("lib/neighborhood_watch/nw_home_screen.dart").readAsStringSync();
    expect(homeSource, contains('pushReplacementNamed("/home")'));
    expect(homeSource, contains("onBack: _returnToAppHome"));
  });
}
