import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/design_system/components/eye_page_header.dart";
import "package:the_eye_mobile/design_system/eye_semantic_colors.dart";
import "package:the_eye_mobile/emergency/active_emergency_contract.dart";
import "package:the_eye_mobile/emergency/active_emergency_progress_presentation.dart";
import "package:the_eye_mobile/emergency/incident_communication_contract.dart";
import "package:the_eye_mobile/emergency/widgets/active_emergency_header.dart";
import "package:the_eye_mobile/emergency/widgets/active_live_video_card.dart";
import "package:the_eye_mobile/emergency/widgets/emergency_cancel_card.dart";
import "package:the_eye_mobile/emergency/widgets/emergency_evidence_card.dart";
import "package:the_eye_mobile/emergency/widgets/emergency_live_banner.dart";
import "package:the_eye_mobile/emergency/widgets/emergency_overview_card.dart";
import "package:the_eye_mobile/emergency/widgets/emergency_quick_actions.dart";
import "package:the_eye_mobile/emergency/widgets/emergency_status_update_card.dart";
import "package:the_eye_mobile/emergency/widgets/emergency_timeline_card.dart";
import "package:the_eye_mobile/emergency/widgets/response_progress_card.dart";
import "package:the_eye_mobile/presentation/citizen_presentation.dart";

ActiveEmergencyActiveContract _active({
  String? publicReference = "EYE-260811-D1B6",
  String displayLabel = "Still ongoing",
  List<ActiveEmergencyProgressStage>? stages,
  ActiveEmergencyLiveVideo? liveVideo,
  List<ActiveEmergencyEvidenceItem> evidence = const [],
  List<ActiveEmergencyTimelineEntry> timeline = const [],
  ActiveEmergencyAllowedActions? actions,
}) {
  return ActiveEmergencyActiveContract(
    incidentId: "11111111-1111-1111-1111-111111111111",
    publicReference: publicReference,
    status: "Verifying",
    displayLabel: displayLabel,
    statusVersion: 3,
    routeType: "active",
    category: "Crime",
    categoryLabel: "Crime",
    description: "Test",
    title: "Emergency",
    reportedAt: DateTime(2026, 8, 11, 20, 23),
    reportedLocation: const ActiveEmergencyLocation(
      latitude: "4.8",
      longitude: "7.0",
      address: "Trans-Amadi, Port Harcourt",
      manualLocationAdjusted: false,
      source: "gps",
      quality: "good",
      liveLocationStale: false,
      locationLabel: "Trans-Amadi, Port Harcourt",
    ),
    evidenceSummary: ActiveEmergencyEvidenceSummary(
      totalCount: evidence.length,
      photos: evidence.where((e) => e.mediaType == "Image").length,
      videos: evidence.where((e) => e.mediaType == "Video").length,
      voice: evidence.where((e) => e.mediaType == "Audio").length,
    ),
    evidenceItems: evidence,
    progressStep: 2,
    progressStages: stages ??
        const [
          ActiveEmergencyProgressStage(
            key: "submitted",
            label: "Submitted",
            state: ActiveEmergencyProgressStageState.complete,
          ),
          ActiveEmergencyProgressStage(
            key: "verifying",
            label: "Verifying",
            state: ActiveEmergencyProgressStageState.current,
          ),
          ActiveEmergencyProgressStage(
            key: "agencyAssigned",
            label: "Agency assigned",
            state: ActiveEmergencyProgressStageState.pending,
          ),
          ActiveEmergencyProgressStage(
            key: "respondersEnRoute",
            label: "Responders en route",
            state: ActiveEmergencyProgressStageState.pending,
          ),
          ActiveEmergencyProgressStage(
            key: "resolved",
            label: "Resolved",
            state: ActiveEmergencyProgressStageState.pending,
          ),
        ],
    allowedActions: actions ??
        const ActiveEmergencyAllowedActions(
          addEvidence: true,
          uploadPhoto: true,
          uploadVideo: true,
          uploadVoice: true,
          addUpdate: true,
          cancel: true,
          requestCancellation: false,
          confirmResolved: true,
          confirmStillOngoing: true,
          addWrittenUpdate: true,
          updateLocation: true,
          retryLiveVideo: true,
        ),
    timelineSummary: timeline,
    lastUpdatedAt: DateTime(2026, 8, 11, 20, 45),
    assignedAgencyName: "Rivers State EMA",
    liveVideo: liveVideo,
    communication: const IncidentCommunicationSummary(
      conversationAvailable: true,
      unreadMessageCount: 0,
      conversationStatus: "Active",
      allowedCommunicationActions: IncidentCommunicationAllowedActions(
        sendText: true,
        sendVoice: true,
        sendPhoto: true,
        sendVideo: false,
        sendLocation: true,
        quickReply: true,
        openThread: true,
      ),
    ),
  );
}

Widget _wrap(Widget child) {
  return MaterialApp(
    theme: ThemeData(
      brightness: Brightness.dark,
      extensions: const [EyeSemanticColors.dark],
    ),
    home: Scaffold(body: SingleChildScrollView(child: child)),
  );
}

void main() {
  testWidgets("header matches Active Emergency secondary pattern",
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        ActiveEmergencyHeader(
          title: "Active Emergency",
          onRefresh: () {},
        ),
      ),
    );
    expect(find.text("Active Emergency"), findsOneWidget);
    expect(find.text("Help is on the way"), findsOneWidget);
    expect(find.byType(EyePageHeader), findsOneWidget);
    expect(find.byTooltip("Back"), findsOneWidget);
    expect(find.byTooltip("Refresh"), findsOneWidget);
    expect(find.byIcon(Icons.arrow_back), findsOneWidget);
    expect(find.byIcon(Icons.refresh), findsOneWidget);
  });

  testWidgets("live banner is factual for non-streaming video", (tester) async {
    await tester.pumpWidget(
      _wrap(EmergencyLiveBanner(active: _active())),
    );
    expect(find.text("Emergency live"), findsOneWidget);
    expect(find.textContaining("STREAMING"), findsNothing);
    expect(find.textContaining("Live video active"), findsNothing);
  });

  testWidgets("overview shows public reference and hides UUID", (tester) async {
    final active = _active();
    await tester.pumpWidget(_wrap(EmergencyOverviewCard(active: active)));
    expect(find.text("EYE-260811-D1B6"), findsOneWidget);
    expect(find.text(active.incidentId), findsNothing);
    expect(find.textContaining("Trans-Amadi"), findsOneWidget);
    expect(find.textContaining("Rivers State EMA"), findsOneWidget);
    expect(find.text("Test"), findsOneWidget);
    expect(find.textContaining("statusVersion"), findsNothing);
  });

  testWidgets("progress tracker collapses to five citizen steps",
      (tester) async {
    final steps = collapseActiveEmergencyProgress(_active().progressStages);
    expect(steps.map((s) => s.label).toList(), [
      "Submitted",
      "Verifying",
      "Agency",
      "Responders",
      "Resolved",
    ]);
    await tester.pumpWidget(_wrap(ResponseProgressCard(active: _active())));
    expect(find.text("Response progress"), findsOneWidget);
    expect(find.text("Submitted"), findsOneWidget);
    expect(find.text("Verifying"), findsOneWidget);
    expect(find.text("Step 3 of 9"), findsNothing);
  });

  testWidgets("live video card shows empty state when not started",
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        ActiveLiveVideoCard(
          active: _active(),
          onStart: () {},
        ),
      ),
    );
    expect(find.text("Live video has not started."), findsOneWidget);
    expect(find.text("Start live video"), findsOneWidget);
    expect(find.text("● STREAMING"), findsNothing);
  });

  testWidgets("live video card shows stop/switch when streaming",
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        ActiveLiveVideoCard(
          active: _active(
            liveVideo: const ActiveEmergencyLiveVideo(
              sessionId: "sess-1",
              status: "Live",
              displayState: "Streaming",
              participantCount: 2,
            ),
          ),
          onStop: () {},
          onSwitchCamera: () {},
        ),
      ),
    );
    expect(find.text("● STREAMING"), findsOneWidget);
    expect(find.text("LIVE"), findsOneWidget);
    expect(find.text("Stop"), findsOneWidget);
    expect(find.text("Switch camera"), findsOneWidget);
  });

  testWidgets("quick actions expose communicate and evidence", (tester) async {
    final active = _active();
    await tester.pumpWidget(
      _wrap(
        EmergencyQuickActions(
          allowedActions: active.allowedActions,
          communication: active.communication,
          onEvidence: () {},
          onCommunicate: () {},
        ),
      ),
    );
    expect(find.text("Evidence"), findsOneWidget);
    expect(find.text("Communicate"), findsOneWidget);
    expect(find.text("Location"), findsOneWidget);
    expect(find.text("Note"), findsOneWidget);
  });

  testWidgets("evidence empty state is factual", (tester) async {
    await tester.pumpWidget(
      _wrap(EmergencyEvidenceCard(active: _active())),
    );
    expect(find.text("No evidence submitted yet."), findsOneWidget);
    expect(find.textContaining("11111111-1111"), findsNothing);
  });

  testWidgets("evidence tiles show compact indexed labels", (tester) async {
    final active = _active(
      evidence: [
        ActiveEmergencyEvidenceItem(
          id: "ev-1",
          mediaType: "Video",
          uploadedAt: DateTime(2026, 8, 11, 20, 26),
          durationSeconds: 24,
        ),
        ActiveEmergencyEvidenceItem(
          id: "ev-2",
          mediaType: "Audio",
          uploadedAt: DateTime(2026, 8, 11, 20, 27),
          durationSeconds: 12,
        ),
      ],
    );
    await tester.pumpWidget(_wrap(EmergencyEvidenceCard(active: active)));
    expect(find.text("Video 1"), findsOneWidget);
    expect(find.text("00:24"), findsOneWidget);
    expect(find.text("Audio 1"), findsOneWidget);
    expect(find.textContaining("00:12"), findsOneWidget);
  });

  testWidgets(
      "status card maps unsafe label without changing API names in UI tree",
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        EmergencyStatusUpdateCard(
          allowedActions: _active().allowedActions,
          onOngoing: () {},
          onResolved: () {},
          onUnsafe: () {},
        ),
      ),
    );
    expect(find.text("Ongoing"), findsOneWidget);
    expect(find.text("Resolved"), findsOneWidget);
    expect(find.text("Unsafe"), findsOneWidget);
    expect(find.text("Unsure"), findsNothing);
  });

  testWidgets("timeline uses citizen copy and strips confidence percent",
      (tester) async {
    expect(
      citizenTimelineMessage(
        message: "Verification confidence scored at 27%",
      ),
      "Your report is being verified",
    );
    await tester.pumpWidget(
      _wrap(
        EmergencyTimelineCard(
          entries: [
            ActiveEmergencyTimelineEntry(
              id: "t1",
              eventType: "LowConfidence",
              message: "Verification confidence scored at 27%",
              createdAt: DateTime(2026, 8, 11, 20, 35),
            ),
            ActiveEmergencyTimelineEntry(
              id: "t2",
              eventType: "EmergencyReportSubmittedThroughFastPath",
              message: "Emergency report submitted through fast path",
              createdAt: DateTime(2026, 8, 11, 20, 23),
            ),
          ],
        ),
      ),
    );
    expect(find.textContaining("27%"), findsNothing);
    expect(find.textContaining("Verification confidence scored"), findsNothing);
    expect(find.textContaining("Your emergency report has been received"),
        findsWidgets);
  });

  testWidgets("cancel row requires explicit action label", (tester) async {
    await tester.pumpWidget(
      _wrap(
        EmergencyCancelCard(
          canCancel: true,
          canRequestCancellation: false,
          onCancel: () {},
        ),
      ),
    );
    expect(find.text("No longer an emergency?"), findsOneWidget);
    expect(find.text("Cancel report"), findsOneWidget);
  });

  testWidgets("large text does not throw on overview", (tester) async {
    tester.view.platformDispatcher.textScaleFactorTestValue = 1.6;
    addTearDown(() {
      tester.view.platformDispatcher.clearTextScaleFactorTestValue();
    });
    await tester.pumpWidget(_wrap(EmergencyOverviewCard(active: _active())));
    expect(find.text("EYE-260811-D1B6"), findsOneWidget);
  });
}
