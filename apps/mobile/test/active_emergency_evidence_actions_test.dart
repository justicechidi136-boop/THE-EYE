import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:http/http.dart" as http;
import "package:http/testing.dart";

import "package:the_eye_mobile/contracts/the_eye_api_client.dart";
import "package:the_eye_mobile/emergency/active_emergency_contract.dart";
import "package:the_eye_mobile/emergency/active_emergency_evidence_actions.dart";

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets("shows empty upload message when no evidence selected",
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ActiveEmergencyEvidenceActions(
            incidentId: "incident-1",
            accessToken: "token",
            allowedActions: const ActiveEmergencyAllowedActions(
              addEvidence: true,
              uploadPhoto: true,
              uploadVideo: true,
              uploadVoice: false,
              addUpdate: false,
              cancel: false,
              requestCancellation: false,
              confirmResolved: false,
              confirmStillOngoing: false,
              addWrittenUpdate: false,
              updateLocation: false,
              retryLiveVideo: false,
            ),
            apiClient: TheEyeApiClient(
              httpClient: MockClient((_) async => http.Response("{}", 200)),
            ),
            onUploaded: () async {},
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final uploadButton = find.widgetWithText(
      FilledButton,
      "Upload selected evidence",
    );
    expect(uploadButton, findsOneWidget);
    expect(tester.widget<FilledButton>(uploadButton).onPressed, isNull);

    await tester.tap(uploadButton, warnIfMissed: false);
    await tester.pump();

    expect(
      find.text("Please select at least one piece of evidence to upload."),
      findsNothing,
    );
  });
}
