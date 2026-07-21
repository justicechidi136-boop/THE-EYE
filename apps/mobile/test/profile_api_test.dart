import "dart:convert";

import "package:flutter_test/flutter_test.dart";
import "package:http/http.dart" as http;
import "package:http/testing.dart";
import "package:the_eye_mobile/contracts/the_eye_api_client.dart";
import "package:the_eye_mobile/contracts/the_eye_api_paths.dart";

void main() {
  test("updateCitizenProfile PATCHes /users/me and parses response", () async {
    final client = TheEyeApiClient(
      baseUrl: "https://api.test/v1",
      httpClient: MockClient((request) async {
        expect(request.method, "PATCH");
        expect(request.url.path, endsWith(TheEyeApiPaths.usersMe));
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        expect(body["firstName"], "Ada");
        expect(body.containsKey("trustScore"), isFalse);
        return http.Response(
          jsonEncode({
            "id": "u1",
            "displayName": "Ada Okeke",
            "kycStatus": "Unverified",
            "profileComplete": true,
            "profile": {
              "firstName": "Ada",
              "lastName": "Okeke",
              "country": "Nigeria",
              "state": "Lagos",
              "lga": "Ikeja",
            },
          }),
          200,
          headers: {"content-type": "application/json"},
        );
      }),
    );

    final profile = await client.updateCitizenProfile(
      accessToken: "token",
      payload: {
        "firstName": "Ada",
        "lastName": "Okeke",
        "country": "Nigeria",
        "state": "Lagos",
        "lga": "Ikeja",
      },
    );

    expect(profile.profileComplete, isTrue);
    expect(profile.profile.firstName, "Ada");
  });

  test("listEmergencyContacts reads paginated data envelope", () async {
    final client = TheEyeApiClient(
      baseUrl: "https://api.test/v1",
      httpClient: MockClient((request) async {
        expect(request.url.path, endsWith(TheEyeApiPaths.usersMeEmergencyContacts));
        return http.Response(
          jsonEncode({
            "data": [
              {
                "id": "c1",
                "name": "Mum",
                "phone": "+2348099990000",
                "relationship": "Parent",
                "priority": 1,
              },
            ],
          }),
          200,
          headers: {"content-type": "application/json"},
        );
      }),
    );

    final contacts = await client.listEmergencyContacts(accessToken: "token");
    expect(contacts, hasLength(1));
    expect(contacts.first.phone, "+2348099990000");
  });

  test("requestAccountDeletion posts confirm true", () async {
    final client = TheEyeApiClient(
      baseUrl: "https://api.test/v1",
      httpClient: MockClient((request) async {
        expect(request.method, "POST");
        expect(request.url.path, endsWith(TheEyeApiPaths.usersMeDeletionRequest));
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        expect(body["confirm"], isTrue);
        return http.Response(
          jsonEncode({
            "ok": true,
            "status": "Deactivated",
            "message": "done",
          }),
          200,
          headers: {"content-type": "application/json"},
        );
      }),
    );

    final result = await client.requestAccountDeletion(accessToken: "token");
    expect(result["ok"], isTrue);
    expect(result["status"], "Deactivated");
  });
}
