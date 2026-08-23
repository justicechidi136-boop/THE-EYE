import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/main.dart" show buildDarkTheme, buildTheme;
import "package:the_eye_mobile/neighborhood_watch/community_post_action_button.dart";

void main() {
  for (final mode in [ThemeMode.light, ThemeMode.dark]) {
    testWidgets(
      "community actions share a baseline on narrow ${mode.name} layout",
      (tester) async {
        tester.view.physicalSize = const Size(320, 640);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);

        var commentTapped = false;
        await tester.pumpWidget(
          MaterialApp(
            theme: buildTheme(false),
            darkTheme: buildDarkTheme(false),
            themeMode: mode,
            home: MediaQuery(
              data: const MediaQueryData(textScaler: TextScaler.linear(1.4)),
              child: Scaffold(
                body: Row(
                  children: [
                    Expanded(
                      child: CommunityPostActionButton(
                        icon: Icons.thumb_up_outlined,
                        label: "Like 120",
                        onPressed: () {},
                      ),
                    ),
                    Expanded(
                      child: CommunityPostActionButton(
                        icon: Icons.chat_bubble_outline,
                        label: "Comment 120",
                        onPressed: () => commentTapped = true,
                      ),
                    ),
                    Expanded(
                      child: CommunityPostActionButton(
                        icon: Icons.share_outlined,
                        label: "Share",
                        onPressed: () {},
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );

        expect(tester.takeException(), isNull);
        final labels = ["Like 120", "Comment 120", "Share"];
        final centers =
            labels.map((label) => tester.getCenter(find.text(label)));
        expect(centers.map((center) => center.dy).toSet().length, 1);

        await tester.tap(find.text("Comment 120"));
        expect(commentTapped, isTrue);
      },
    );
  }
}
