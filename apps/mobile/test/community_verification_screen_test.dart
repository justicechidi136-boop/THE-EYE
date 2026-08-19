import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/community_verification/community_verification_screen.dart";
import "package:the_eye_mobile/community_verification/community_verification_service.dart";
import "package:the_eye_mobile/contracts/the_eye_api_client.dart";

class _FakeCommunityVerificationService extends CommunityVerificationService {
  _FakeCommunityVerificationService({
    required this.payload,
    this.completion = const CommunityVerificationCompletion(
      requestId: "req-1",
      completed: true,
      responseType: "Skipped",
      message: "Thank you for helping verify this incident safely.",
      nextRoute: "/home",
    ),
  }) : super(TheEyeApiClient(baseUrl: "https://example.com"));

  final CommunityVerificationPayload payload;
  final CommunityVerificationCompletion completion;
  int markOpenedCalls = 0;
  String? lastResponseType;
  bool skipCalled = false;

  @override
  Future<CommunityVerificationPayload> fetchPayload({
    required String requestId,
    required String accessToken,
  }) async {
    return payload;
  }

  @override
  Future<void> markOpened({
    required String requestId,
    required String accessToken,
  }) async {
    markOpenedCalls += 1;
  }

  @override
  Future<CommunityVerificationCompletion> respond({
    required String requestId,
    required String accessToken,
    required String responseType,
    required String clientActionId,
    String? confidence,
    String? note,
    String? voiceAttachmentId,
  }) async {
    lastResponseType = responseType;
    return completion;
  }

  @override
  Future<CommunityVerificationCompletion> skip({
    required String requestId,
    required String accessToken,
    required String clientActionId,
    String? reason,
  }) async {
    skipCalled = true;
    return completion;
  }
}

Widget _wrap(Widget child) {
  return MaterialApp(home: child);
}

void main() {
  testWidgets("renders formal verification actions and evidence previews",
      (tester) async {
    final service = _FakeCommunityVerificationService(
      payload: CommunityVerificationPayload(
        requestId: "req-1",
        category: "SuspiciousActivity",
        categoryDisplayLabel: "Suspicious Activity",
        approximateArea: "Ikeja, LA",
        approximateDistance: "approximately 300 metres",
        distanceBand: "WITHIN_500_M",
        reportTime: "2026-08-18T09:30:00.000Z",
        sanitizedDescription: "Suspicious vehicle parked near the gate.",
        safetyNotice: "Do not approach danger.",
        allowedResponses: const ["Confirmed", "NotFound", "StillOngoing"],
        spokenSummaryTemplate: "Summary",
        expiry: "2026-08-18T10:15:00.000Z",
        alreadyResponded: false,
        isExpired: false,
        approvedEvidencePreviews: const [
          CommunityVerificationEvidencePreview(
            id: "img-1",
            mediaType: "image",
            previewUrl: "https://example.com/photo.jpg",
          ),
          CommunityVerificationEvidencePreview(
            id: "aud-1",
            mediaType: "audio",
            previewUrl: "https://example.com/audio.mp3",
          ),
        ],
      ),
    );

    await tester.pumpWidget(
      _wrap(
        CommunityVerificationScreen(
          requestId: "req-1",
          service: service,
          accessToken: "token",
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text("Verification Detail"), findsOneWidget);
    expect(find.text("Immediate danger? Report Emergency"), findsOneWidget);
    expect(find.text("Confirm Incident"), findsOneWidget);
    expect(find.text("Incident Not Found"), findsOneWidget);
    expect(find.text("Skip"), findsOneWidget);
    expect(find.text("Still Ongoing"), findsNothing);
    expect(find.text("Evidence"), findsOneWidget);
    expect(find.text("Photo evidence"), findsOneWidget);
    expect(find.text("Audio evidence"), findsOneWidget);
    expect(service.markOpenedCalls, 1);
  });

  testWidgets("skip submits through canonical skip endpoint", (tester) async {
    final service = _FakeCommunityVerificationService(
      payload: CommunityVerificationPayload(
        requestId: "req-1",
        category: "SuspiciousActivity",
        categoryDisplayLabel: "Suspicious Activity",
        approximateArea: "Ikeja, LA",
        approximateDistance: "approximately 300 metres",
        distanceBand: "WITHIN_500_M",
        reportTime: "2026-08-18T09:30:00.000Z",
        sanitizedDescription: "Suspicious vehicle parked near the gate.",
        safetyNotice: "Do not approach danger.",
        allowedResponses: const ["Confirmed", "NotFound"],
        spokenSummaryTemplate: "Summary",
        expiry: "2026-08-18T10:15:00.000Z",
        alreadyResponded: false,
        isExpired: false,
        approvedEvidencePreviews: const [],
      ),
    );

    await tester.pumpWidget(
      _wrap(
        CommunityVerificationScreen(
          requestId: "req-1",
          service: service,
          accessToken: "token",
        ),
      ),
    );
    await tester.pumpAndSettle();

    final skipFinder = find.text("Skip");
    await tester.ensureVisible(skipFinder);
    await tester.pumpAndSettle();

    await tester.tap(skipFinder);
    await tester.pumpAndSettle();

    expect(service.skipCalled, isTrue);
    expect(find.text("Return home"), findsOneWidget);
  });
}
