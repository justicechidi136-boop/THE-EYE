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
      "profileComplete": true,
      "profile": {
        "firstName": "Ada",
        "lastName": "Okeke",
        "country": "Nigeria",
        "state": "Lagos",
        "lga": "Ikeja",
        "avatarUrl": "https://cdn.example/avatars/a.jpg",
      },
      "emergencyContacts": [
        {
          "id": "c1",
          "name": "Mum",
          "phone": "+2348099990000",
          "relationship": "Parent",
          "priority": 1,
        },
      ],
      "emergencyContact": {"name": "Mum", "phone": "+2348099990000"},
    });

    expect(profile.displayName, "Ada Okeke");
    expect(profile.kycStatus, "Verified");
    expect(profile.trustScore, 91);
    expect(profile.profileComplete, isTrue);
    expect(profile.profile.avatarUrl, "https://cdn.example/avatars/a.jpg");
    expect(profile.emergencyContacts, hasLength(1));
    expect(profile.emergencyContactPhone, "+2348099990000");
  });

  test("CitizenProfile falls back when display name missing", () {
    final profile = CitizenProfile.fromJson({
      "id": "user-2",
      "email": "fallback@example.com",
      "kycStatus": "Unverified",
      "profileComplete": false,
    });

    expect(profile.displayName, "fallback@example.com");
    expect(profile.trustScore, isNull);
    expect(profile.emergencyContactPhone, isNull);
    expect(profile.profileComplete, isFalse);
  });

  test("CitizenProfile treats null trustScore as unavailable", () {
    final profile = CitizenProfile.fromJson({
      "id": "user-3",
      "displayName": "No Score",
      "kycStatus": "Pending",
      "trustScore": null,
      "profileComplete": true,
      "profile": {
        "firstName": "No",
        "lastName": "Score",
        "country": "Ghana",
        "state": "Accra",
        "lga": "Ablekuma",
      },
    });

    expect(profile.trustScore, isNull);
    expect(profile.profileComplete, isTrue);
  });

  test("CitizenProfile uses server profileComplete over client heuristic", () {
    final incompleteOnServer = CitizenProfile.fromJson({
      "id": "user-4",
      "displayName": "Google User",
      "kycStatus": "Unverified",
      "profileComplete": false,
      "profile": {
        "firstName": "Google",
        "lastName": "User",
        "country": "Nigeria",
        "state": "Lagos",
        "lga": "Ikeja",
      },
    });
    expect(incompleteOnServer.profileComplete, isFalse);

    final completeOnServer = CitizenProfile.fromJson({
      "id": "user-5",
      "displayName": "Ada",
      "kycStatus": "Unverified",
      "profileComplete": true,
      "profile": {
        "firstName": "Ada",
        "lastName": "Okeke",
      },
    });
    expect(completeOnServer.profileComplete, isTrue);
  });

  test("EmergencyContact parses CRUD payload fields", () {
    final contact = EmergencyContact.fromJson({
      "id": "ec-1",
      "name": "Chinwe",
      "phone": "+2348011112222",
      "relationship": "Spouse",
      "priority": 2,
    });

    expect(contact.id, "ec-1");
    expect(contact.priority, 2);
    expect(contact.relationship, "Spouse");
  });
}
