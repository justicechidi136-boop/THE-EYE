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

  test("fallback share text uses the approved missing-person structure", () {
    final payload = BroadcastPublicShareMapper.fromPartialSource(
      {
        "id": "b-missing",
        "type": "MissingPerson",
        "status": "Active",
        "title": "Missing person: Pele Vic",
        "approximateArea": "Rumuola, Port Harcourt, Rivers State",
        "lastSeenAt": "2026-08-13T13:45:00.000Z",
        "shareUrl": BroadcastPublicShareMapper.publicShareUrlForId(
          "b-missing",
          flavor: "staging",
        ),
      },
      locallyGenerated: true,
    );

    expect(payload.shareText, startsWith("🚨 Missing Person Alert"));
    expect(payload.shareText, contains("Missing person: Pele Vic"));
    expect(
      payload.shareText,
      contains(
        "Last known location: Rumuola, Port Harcourt, Rivers State",
      ),
    );
    expect(payload.shareText, contains("Last seen:"));
    expect(
      payload.shareText,
      contains(
        "View full broadcast: https://staging-dashboard8jps.theeye.com.ng/share/broadcasts/b-missing",
      ),
    );
    expect(payload.shareText, isNot(contains("\nLocation:")));
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
