import "dart:io";

import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/design_system/components/eye_bottom_nav.dart";
import "package:the_eye_mobile/neighborhood_watch/neighborhood_watch_prototype_chrome.dart";

void main() {
  testWidgets("primary navigation exposes the approved Watch destination",
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
    expect(find.text("Watch"), findsOneWidget);
    expect(find.text("Broadcasts"), findsOneWidget);
    await tester.tap(find.text("Watch"));
    expect(selected, 1);
  });

  test("navigation selection treats Tracking as Home and NW as Watch", () {
    expect(EyeNavRoutes.selectedIndexForRoute("/tracking"), 0);
    expect(
      EyeNavRoutes.selectedIndexForRoute("/neighborhood-watch/feed"),
      1,
    );
  });

  test("Home owns Tracking and the Services screen is removed", () {
    final mainSource = File("lib/main.dart").readAsStringSync();
    final homeSource = mainSource.substring(
      mainSource.indexOf("class HomeScreen"),
      mainSource.indexOf("class ReportScreen"),
    );
    expect(mainSource, contains('title: "Incident Tracking"'));
    expect(homeSource, isNot(contains('title: "Safety broadcasts"')));
    expect(
        homeSource,
        isNot(contains(
            'ActionTile(\n                        "Safety broadcasts"')));
    expect(mainSource, isNot(contains("class ServicesHubScreen")));
    expect(mainSource, isNot(contains('"/services":')));
  });

  test("report submit action keeps Android navigation clearance", () {
    final mainSource = File("lib/main.dart").readAsStringSync();
    final reportSource = mainSource.substring(
      mainSource.indexOf("class ReportScreen"),
      mainSource.indexOf("class MissingPersonBroadcastScreen"),
    );
    expect(reportSource, contains("EyeTokens.contentBottomClearance"));
  });

  test("Watch opens the location-resolved feed-first experience", () {
    final homeSource =
        File("lib/neighborhood_watch/nw_home_screen.dart").readAsStringSync();
    expect(homeSource, contains('title: "Neighborhood Feed"'));
    expect(homeSource, contains("Eyes · See what is happening around you"));
    expect(homeSource, contains('tooltip: "Open community chat"'));
    expect(homeSource, isNot(contains('labels: const ["Home", "Feed"')));
    expect(homeSource, isNot(contains('Text("Join community")')));
    expect(homeSource, isNot(contains('Text("Request community")')));
  });

  test("legacy Neighborhood Watch routes resolve to simplified surfaces", () {
    final mainSource = File("lib/main.dart").readAsStringSync();
    expect(
      RegExp(r'"/neighborhood-watch/feed"[\s\S]{0,80}NeighborhoodWatchHomeScreen')
          .hasMatch(mainSource),
      isTrue,
    );
    expect(
      RegExp(r'"/neighborhood-watch/chat"[\s\S]{0,500}CommunityFeedScreen')
          .hasMatch(mainSource),
      isTrue,
    );
    expect(
      RegExp(
        r'"/neighborhood-watch/communities"[\s\S]{0,120}NeighborhoodWatchHomeScreen\(openChatWhenReady: true\)',
      ).hasMatch(mainSource),
      isTrue,
    );
    expect(
      RegExp(r'"/neighborhood-watch/broadcasts"[\s\S]{0,80}BroadcastCenterScreen')
          .hasMatch(mainSource),
      isTrue,
    );
    expect(mainSource, contains('args["contextResolved"] == true'));
  });

  test("Community Chat back pops to Feed without creating a route loop", () {
    final mainSource = File("lib/main.dart").readAsStringSync();
    expect(mainSource, contains("if (navigator.canPop())"));
    expect(mainSource, contains("navigator.pop();"));
    expect(
      mainSource,
      contains(
        "navigator.pushReplacementNamed(NeighborhoodWatchDestinations.feed)",
      ),
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
