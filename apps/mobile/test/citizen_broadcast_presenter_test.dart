import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/broadcasts/broadcast_action_policy.dart";
import "package:the_eye_mobile/broadcasts/broadcast_feed_service.dart";
import "package:the_eye_mobile/l10n/generated/app_localizations_en.dart";
import "package:the_eye_mobile/presentation/citizen_broadcast_presenter.dart";

void main() {
  BroadcastFeedItem item({
    String type = "StolenVehicle",
    String status = "Active",
    String? owner = "owner-1",
    bool expired = false,
    Map<String, dynamic> metadata = const {},
  }) =>
      BroadcastFeedItem(
        id: "broadcast-1",
        type: type,
        title: "Citizen Broadcast",
        body: "P2Urgent",
        priority: "P2Urgent",
        read: false,
        publishedAt: DateTime.utc(2026, 8, 19, 12),
        status: status,
        creatorUserId: owner,
        expired: expired,
        metadata: metadata,
      );

  test("owner and viewer action matrices cover both safety broadcast types",
      () {
    for (final type in ["StolenVehicle", "MissingPerson"]) {
      final owner = BroadcastActionPolicy.forViewer(
        broadcast: item(type: type),
        currentUserId: "owner-1",
      );
      expect(owner.isOwner, isTrue);
      expect(owner.canShare, isTrue);
      expect(owner.canReportSighting, isTrue);
      expect(owner.canComment, isTrue);
      expect(owner.canResolve, isTrue);
      expect(owner.canWithdraw, isTrue);
      expect(owner.canReportBroadcast, isFalse);

      final viewer = BroadcastActionPolicy.forViewer(
        broadcast: item(type: type),
        currentUserId: "viewer-1",
      );
      expect(viewer.isOwner, isFalse);
      expect(viewer.canShare, isTrue);
      expect(viewer.canReportSighting, isTrue);
      expect(viewer.canComment, isTrue);
      expect(viewer.canReportBroadcast, isTrue);
      expect(viewer.canResolve, isFalse);
      expect(viewer.canWithdraw, isFalse);
    }
  });

  test("terminal broadcasts hide live-only actions", () {
    for (final status in [
      "Resolved",
      "WithdrawnByAuthor",
      "Suspended",
      "Expired"
    ]) {
      final policy = BroadcastActionPolicy.forViewer(
        broadcast: item(status: status, expired: status == "Expired"),
        currentUserId: "owner-1",
      );
      expect(policy.canReportSighting, isFalse);
      expect(policy.canReportBroadcast, isFalse);
      expect(policy.canResolve, isFalse);
      expect(policy.canWithdraw, isFalse);
    }
  });

  test("stolen vehicle presentation uses masked plate and friendly values", () {
    final presentation = CitizenBroadcastPresenter.present(
      item(
        status: "WithdrawnByAuthor",
        metadata: const {
          "make": "Toyota",
          "model": "Corolla",
          "colour": "Yellow",
          "registrationMasked": "****-ABJ",
          "stolenAt": "2026-08-13T11:56:35.451Z",
        },
      ),
      AppLocalizationsEn(),
      now: DateTime.utc(2026, 8, 20, 12),
    );

    expect(presentation.title, "Stolen vehicle: Toyota Corolla (****-ABJ)");
    expect(presentation.summary, contains("reported stolen on 13 Aug 2026"));
    expect(presentation.statusLabel, "Withdrawn");
    expect(presentation.metadataLine, isNot(contains("WithdrawnByAuthor")));
    expect(presentation.metadataLine, isNot(contains("P2Urgent")));
  });

  test("missing person presentation handles exact and range ages", () {
    final exact = CitizenBroadcastPresenter.present(
      item(
        type: "MissingPerson",
        metadata: const {
          "fullName": "Pele Vic",
          "ageOrApproximateAge": "15",
          "lastSeenAt": "2026-08-04T16:10:00.000Z",
        },
      ),
      AppLocalizationsEn(),
    );
    final range = CitizenBroadcastPresenter.present(
      item(
        type: "MissingPerson",
        metadata: const {
          "fullName": "Ada Obi",
          "ageOrApproximateAge": "10-15",
          "lastSeenAt": "2026-08-04T16:10:00.000Z",
        },
      ),
      AppLocalizationsEn(),
    );

    expect(exact.title, "Missing person: Pele Vic");
    expect(exact.summary, contains("15-year-old Pele Vic"));
    expect(range.summary, contains("approximately 10–15 years old"));
    expect(range.summary, isNot(contains("10–15-year-old")));
  });
}
