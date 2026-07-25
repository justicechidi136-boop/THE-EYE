import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/brand.dart";
import "package:the_eye_mobile/design_system/eye_semantic_colors.dart";
import "package:the_eye_mobile/neighborhood_watch/community_members_screen.dart";
import "package:the_eye_mobile/neighborhood_watch/community_report_screen.dart";
import "package:the_eye_mobile/widgets/eye_scaffold.dart";

void main() {
  Widget wrap(Widget child) {
    return MaterialApp(
      theme: ThemeData(
        brightness: Brightness.dark,
        extensions: const [EyeSemanticColors.dark],
      ),
      home: child,
    );
  }

  testWidgets("EyeScaffold uses dark semantic background", (tester) async {
    await tester.pumpWidget(
      wrap(
        const EyeScaffold(
          title: "Test",
          body: SizedBox(),
        ),
      ),
    );
    final scaffold = tester.widget<Scaffold>(find.byType(Scaffold));
    expect(scaffold.backgroundColor, BrandColors.darkBackground);
  });

  testWidgets("Community report screen uses dark scaffold", (tester) async {
    await tester.pumpWidget(
      wrap(
        CommunityReportScreen(
          accessToken: "token",
          args: const CommunityReportRouteArgs(
            communityId: "c1",
            targetType: "Post",
            targetId: "p1",
            targetLabel: "Test post",
          ),
        ),
      ),
    );
    final scaffold = tester.widget<Scaffold>(find.byType(Scaffold));
    expect(scaffold.backgroundColor, BrandColors.darkBackground);
  });
}
