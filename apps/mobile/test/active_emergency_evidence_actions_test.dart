import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:http/http.dart" as http;
import "package:http/testing.dart";

import "package:the_eye_mobile/contracts/the_eye_api_client.dart";
import "package:the_eye_mobile/emergency/active_emergency_contract.dart";
import "package:the_eye_mobile/emergency/active_emergency_evidence_actions.dart";
import "package:the_eye_mobile/evidence/evidence_upload_coordinator.dart";
import "package:the_eye_mobile/incidents/incident_media_reference.dart";

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test("confirmed partial batch requires authoritative refresh", () {
    final batch = EvidenceUploadBatchResult(
      uploaded: const [
        IncidentMediaReference(
          id: "media-1",
          mediaType: "Image",
          bucket: "private-bucket",
          objectKey: "evidence/incident-1/photo.jpg",
          contentType: "image/jpeg",
          fileHash: "sha256:photo",
        ),
      ],
      failures: const [
        EvidenceUploadItemResult(
          localId: "local-video",
          success: false,
          userMessage: "Upload failed.",
        ),
      ],
    );

    expect(batch.isPartialSuccess, isTrue);
    expect(shouldRefreshAfterEvidenceUpload(batch), isTrue);
    expect(batch.failures.single.localId, "local-video");
  });

  test("total upload failure does not trigger canonical refresh", () {
    const batch = EvidenceUploadBatchResult(
      uploaded: [],
      failures: [
        EvidenceUploadItemResult(
          localId: "local-photo",
          success: false,
        ),
      ],
    );

    expect(shouldRefreshAfterEvidenceUpload(batch), isFalse);
  });

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
            onUploaded: ({required bool closeSheet}) async => true,
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
