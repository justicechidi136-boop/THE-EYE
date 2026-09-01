import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/design_system/components/eye_incident_summary_card.dart";
import "package:the_eye_mobile/design_system/components/eye_notification_card.dart";
import "package:the_eye_mobile/design_system/components/eye_service_card.dart";
import "package:the_eye_mobile/widgets/flat_section.dart";

void main() {
  testWidgets("shared citizen surfaces stay flat at narrow widths",
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 320,
            child: ListView(
              children: [
                const SizedBox(
                  height: 116,
                  child: EyeServiceCard(
                    title: "Nearest Police Station",
                    description: "Find help close to your current location.",
                    icon: Icons.local_police_outlined,
                    onTap: _noop,
                  ),
                ),
                const FlatSection(
                  title: "Account",
                  child: ListTile(title: Text("Profile and security")),
                ),
                const EyeNotificationCard(
                  title: "Emergency report received",
                  body: "Your report has been submitted successfully.",
                  timestamp: "2m ago",
                ),
                EyeIncidentSummaryCard.fromIncidentFields(
                  title: "Road Accident",
                  incidentId: "11111111-2222-3333-4444-555555555555",
                  status: "Verifying",
                  reportedAt: DateTime.utc(2026, 8, 10, 20, 42),
                ),
              ],
            ),
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.byType(Card), findsNothing);
    expect(find.byType(Divider), findsWidgets);
    expect(tester.takeException(), isNull);
  });
}

void _noop() {}
