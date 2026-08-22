import "dart:async";

import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/activity/activity_history_service.dart";
import "package:the_eye_mobile/activity/incident_archive_contract.dart";
import "package:the_eye_mobile/activity/incident_archive_screen.dart";
import "package:the_eye_mobile/design_system/eye_semantic_colors.dart";
import "package:the_eye_mobile/emergency/active_emergency_contract.dart";
import "package:the_eye_mobile/emergency/widgets/active_emergency_skeleton.dart";
import "package:the_eye_mobile/l10n/generated/app_localizations.dart";

class _ArchiveService extends ActivityHistoryService {
  _ArchiveService(this.archive);

  final IncidentArchiveContract archive;

  @override
  Future<IncidentArchiveContract> getIncidentArchiveContract({
    required String accessToken,
    required String incidentId,
  }) async =>
      archive;

  @override
  Future<Uri> getIncidentEvidenceViewUrl({
    required String accessToken,
    required String incidentId,
    required String mediaId,
  }) async =>
      Uri.parse("https://example.invalid/evidence/$mediaId");
}

class _PendingArchiveService extends ActivityHistoryService {
  final _pending = Completer<IncidentArchiveContract>();

  @override
  Future<IncidentArchiveContract> getIncidentArchiveContract({
    required String accessToken,
    required String incidentId,
  }) =>
      _pending.future;
}

class _FailingArchiveService extends ActivityHistoryService {
  @override
  Future<IncidentArchiveContract> getIncidentArchiveContract({
    required String accessToken,
    required String incidentId,
  }) async {
    throw StateError("private technical failure");
  }
}

IncidentArchiveContract _archive({
  ArchivedEmergencyTerminalState state =
      ArchivedEmergencyTerminalState.resolved,
  List<IncidentArchiveDispatchEntry> dispatch = const [],
  List<IncidentArchiveEvidenceItem> evidence = const [],
  String? reason = "Situation is safe",
}) {
  return IncidentArchiveContract(
    incidentId: "11111111-1111-1111-1111-111111111111",
    publicReference: "EYE-260820-1111",
    category: "Fire",
    title: "Fire emergency",
    status: state == ArchivedEmergencyTerminalState.cancelled
        ? "CancelledByReporter"
        : "Resolved",
    terminalState: state,
    reportedAt: DateTime.utc(2026, 8, 20, 8),
    terminalAt: DateTime.utc(2026, 8, 20, 9, 30),
    description: "Smoke reported near the entrance",
    finalReason: reason,
    resolutionSource: "Reporter",
    agency: dispatch.isEmpty ? null : "State Fire Service",
    verificationStatus: "Verified",
    communitySummary: "Community verification received",
    location: const IncidentArchiveLocation(
      address: "12 Market Road",
      jurisdiction: "Ikeja, Lagos",
    ),
    evidence: evidence,
    timeline: [
      IncidentArchiveTimelineEntry(
        label: "Emergency report submitted",
        type: "report.submitted",
        at: DateTime.utc(2026, 8, 20, 8),
      ),
      if (state == ArchivedEmergencyTerminalState.cancelled)
        IncidentArchiveTimelineEntry(
          label: "Incident cancelled: Reported by mistake",
          type: "incident.cancelled",
          at: DateTime.utc(2026, 8, 20, 8, 5),
        )
      else
        IncidentArchiveTimelineEntry(
          label: "Verification completed",
          type: "verification.updated",
          at: DateTime.utc(2026, 8, 20, 8, 10),
        ),
    ],
    dispatchTimeline: dispatch,
  );
}

Widget _app(IncidentArchiveContract archive,
    {ThemeMode mode = ThemeMode.light, ActivityHistoryService? service}) {
  return MaterialApp(
    themeMode: mode,
    theme: ThemeData(
      brightness: Brightness.light,
      extensions: const [EyeSemanticColors.light],
    ),
    darkTheme: ThemeData(
      brightness: Brightness.dark,
      extensions: const [EyeSemanticColors.dark],
    ),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: IncidentArchiveScreen(
      incidentId: archive.incidentId,
      accessToken: "test-token",
      service: service ?? _ArchiveService(archive),
    ),
  );
}

Future<void> _show(WidgetTester tester, Finder finder) async {
  await tester.scrollUntilVisible(
    finder,
    300,
    scrollable: find.byType(Scrollable).last,
  );
  await tester.pump();
}

void main() {
  test("typed contract sorts history and derives a citizen reference", () {
    final archive = IncidentArchiveContract.fromJson({
      "incidentId": "11111111-1111-1111-1111-111111111111",
      "category": "Emergency",
      "status": "Resolved",
      "title": "Emergency",
      "createdAt": "2026-08-20T08:00:00.000Z",
      "resolvedAt": "2026-08-20T09:00:00.000Z",
      "location": {"address": "12 Market Road", "latitude": 6.5},
      "timeline": [
        {
          "label": "Incident resolved",
          "type": "incident.resolved",
          "at": "2026-08-20T09:00:00.000Z",
        },
        {
          "label": "Emergency report submitted",
          "type": "report.submitted",
          "at": "2026-08-20T08:00:00.000Z",
        },
      ],
    });

    expect(archive.publicReference, "EYE-260820-1111");
    expect(archive.timeline.first.type, "report.submitted");
    expect(archive.location.label, "12 Market Road");
  });

  test("cancelled progress does not invent agency or responder stages", () {
    final archive = _archive(
      state: ArchivedEmergencyTerminalState.cancelled,
      reason: "Reported by mistake",
    );
    final steps = archive.progressSteps;
    expect(steps[0].state, ActiveEmergencyProgressStageState.complete);
    expect(steps[2].state, ActiveEmergencyProgressStageState.skipped);
    expect(steps[3].state, ActiveEmergencyProgressStageState.skipped);
    expect(steps[4].label, "Cancelled");
    expect(steps[4].state, ActiveEmergencyProgressStageState.complete);
  });

  test("resolved response completes only stages supported by history", () {
    final archive = _archive(
      dispatch: [
        IncidentArchiveDispatchEntry(
          label: "Agency assigned",
          agency: "State Fire Service",
          at: DateTime.utc(2026, 8, 20, 8, 20),
        ),
        IncidentArchiveDispatchEntry(
          label: "Response completed",
          agency: "State Fire Service",
          at: DateTime.utc(2026, 8, 20, 9, 30),
        ),
      ],
    );
    expect(
      archive.progressSteps.map((step) => step.state),
      everyElement(ActiveEmergencyProgressStageState.complete),
    );
  });

  testWidgets("resolved archive is citizen-readable and has no active controls",
      (tester) async {
    final archive = _archive(
      dispatch: [
        IncidentArchiveDispatchEntry(
          label: "Response completed",
          agency: "State Fire Service",
          at: DateTime.utc(2026, 8, 20, 9, 30),
        ),
      ],
      evidence: [
        IncidentArchiveEvidenceItem(
          id: "photo-1",
          mediaType: "Image",
          uploadedAt: DateTime.utc(2026, 8, 20, 8, 2),
        ),
        IncidentArchiveEvidenceItem(
          id: "video-1",
          mediaType: "Video",
          uploadedAt: DateTime.utc(2026, 8, 20, 8, 3),
          durationSeconds: 12,
        ),
        IncidentArchiveEvidenceItem(
          id: "audio-1",
          mediaType: "Audio",
          uploadedAt: DateTime.utc(2026, 8, 20, 8, 4),
          durationSeconds: 8,
        ),
      ],
    );
    await tester.pumpWidget(_app(archive));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    expect(find.text("Fire archive"), findsOneWidget);
    expect(find.text("Incident resolved"), findsOneWidget);
    expect(find.text("EYE-260820-1111"), findsWidgets);
    expect(find.text("12 Market Road\nIkeja, Lagos"), findsOneWidget);
    expect(find.text("Map coordinates"), findsNothing);
    expect(find.textContaining("4.8156"), findsNothing);
    expect(find.text("Start Live Video"), findsNothing);
    expect(find.text("Add evidence"), findsNothing);
    expect(find.text("Cancel Emergency"), findsNothing);
    expect(find.text("Confirm still ongoing"), findsNothing);

    await _show(tester, find.text("Audio 1"));
    expect(find.text("Photo 1"), findsOneWidget);
    expect(find.text("Video 1"), findsOneWidget);
    expect(find.text("00:12"), findsOneWidget);
    expect(find.text("Audio 1"), findsOneWidget);
    expect(find.textContaining("00:08"), findsOneWidget);

    await _show(tester, find.text("View communication history"));
    expect(find.textContaining("Read only"), findsOneWidget);
    expect(find.text("Response completed"), findsWidgets);
  });

  testWidgets("cancelled and no-evidence states use terminal language",
      (tester) async {
    final archive = _archive(
      state: ArchivedEmergencyTerminalState.cancelled,
      reason: "Reported by mistake",
    );
    await tester.pumpWidget(_app(archive, mode: ThemeMode.dark));
    await tester.pump();

    expect(find.text("Incident cancelled"), findsOneWidget);
    await _show(tester, find.text("Reported by mistake"));
    expect(find.text("CANCELLATION REASON"), findsOneWidget);
    await _show(tester, find.text("No evidence submitted."));
    expect(find.text("No evidence submitted."), findsOneWidget);
    await _show(tester, find.text("No dispatch activity recorded."));
    expect(find.text("No dispatch activity recorded."), findsOneWidget);
  });

  testWidgets("loading uses the structured emergency skeleton", (tester) async {
    await tester.pumpWidget(
      _app(_archive(), service: _PendingArchiveService()),
    );
    await tester.pump();

    expect(find.byType(ActiveEmergencySkeleton), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });

  testWidgets("archive failure shows safe retry without raw exception text",
      (tester) async {
    await tester.pumpWidget(
      _app(_archive(), service: _FailingArchiveService()),
    );
    await tester.pump();
    await tester.pump();

    expect(find.text("Unable to load archive"), findsOneWidget);
    expect(find.text("Retry"), findsOneWidget);
    expect(find.textContaining("private technical failure"), findsNothing);
  });
}
