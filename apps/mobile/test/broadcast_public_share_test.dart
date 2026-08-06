import "package:flutter_test/flutter_test.dart";

import "package:the_eye_mobile/broadcasts/broadcast_feed_service.dart";
import "package:the_eye_mobile/broadcasts/broadcast_public_share.dart";

void main() {
  test("public share mapper excludes sensitive fields from fallback output",
      () {
    final payload = BroadcastPublicShareMapper.fromPartialSource(
      {
        "id": "b1",
        "type": "StolenVehicle",
        "status": "Active",
        "title": "Stolen vehicle: Toyota Corolla (AB***23)",
        "authorPhone": "+2348000000000",
        "latitude": 6.5244,
        "longitude": 3.3792,
        "registrationNumber": "ABC123XY",
        "vin": "1HGCM82633A004352",
        "internalMediaUrl": "s3://private/evidence/raw.jpg",
        "witnessName": "John Doe",
        "body": "Owner phone 0800... last seen at 12 Adeola street",
      },
      locallyGenerated: true,
    );

    expect(payload.locallyGenerated, isTrue);
    expect(payload.shareText, isNot(contains("+234")));
    expect(payload.shareText, isNot(contains("ABC123XY")));
    expect(payload.shareText, isNot(contains("1HGCM82633A004352")));
    expect(payload.shareText, isNot(contains("0800")));
    expect(payload.shareText, isNot(contains("Adeola")));
    expect(payload.shareText, isNot(contains("John Doe")));
    expect(payload.shareText, contains("Preview generated on this device"));
    expect(
      BroadcastPublicShareMapper.containsSensitiveShareData({
        "authorPhone": "+234800",
      }),
      isTrue,
    );
  });

  test("feed item fallback never includes unrestricted body text", () {
    final item = BroadcastFeedItem.fromJson({
      "id": "b1",
      "type": "MissingPerson",
      "title": "Missing person: Ada",
      "body": "Contact owner at 08001234567. Last seen at 12 Private Lane.",
      "priority": "P2ActiveCrimeAccident",
      "read": false,
      "publishedAt": "2026-08-06T10:00:00.000Z",
      "status": "Active",
      "deepLink": "/broadcasts/b1",
    });

    final payload = BroadcastPublicShareMapper.fromFeedItemFallback(item);
    expect(payload.summary, "Missing person: Ada");
    expect(payload.shareText, isNot(contains("08001234567")));
    expect(payload.shareText, isNot(contains("Private Lane")));
    expect(payload.locallyGenerated, isTrue);
  });

  test("api share payload parses public-safe fields only", () {
    final payload = BroadcastPublicSharePayload.fromApiJson({
      "data": {
        "id": "b1",
        "type": "MissingPerson",
        "status": "Resolved",
        "title": "Missing person: Ada",
        "summary": "Missing person alert: Ada, approx. age 10.",
        "deepLink": "/broadcasts/b1",
        "shareUrl": "/share/broadcasts/b1",
        "statusBanner": "Resolved",
      },
    });

    expect(payload.statusBanner, "Resolved");
    expect(payload.shareText, contains("Missing person: Ada"));
    expect(payload.locallyGenerated, isFalse);
  });

  for (final key in BroadcastPublicShareMapper.sensitiveFieldKeys) {
    test("sensitive share field $key is excluded from mapper output", () {
      final payload = BroadcastPublicShareMapper.fromPartialSource(
        {
          "id": "b1",
          "type": "Emergency",
          "status": "Active",
          "title": "Notice",
          key: "SHOULD_NOT_APPEAR",
        },
        locallyGenerated: true,
      );
      expect(payload.shareText, isNot(contains("SHOULD_NOT_APPEAR")));
    });
  }
}
