import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/contracts/the_eye_api_client.dart";

void main() {
  test("CitizenProfile parses API /users/me payload", () {
    final profile = CitizenProfile.fromJson({
      "id": "user-1",
      "displayName": "Ada Okeke",
      "email": "ada@example.com",
      "kycStatus": "Verified",
      "trustScore": 91,
      "emergencyContact": {"name": "Mum", "phone": "+2348099990000"},
    });

    expect(profile.displayName, "Ada Okeke");
    expect(profile.kycStatus, "Verified");
    expect(profile.trustScore, 91);
    expect(profile.emergencyContactPhone, "+2348099990000");
  });

  test("CitizenProfile falls back when display name missing", () {
    final profile = CitizenProfile.fromJson({
      "id": "user-2",
      "email": "fallback@example.com",
      "kycStatus": "Unverified",
    });

    expect(profile.displayName, "fallback@example.com");
    expect(profile.trustScore, isNull);
    expect(profile.emergencyContactPhone, isNull);
  });
}
