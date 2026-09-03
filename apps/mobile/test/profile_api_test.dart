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
        expect(body["country"], "Nigeria");
        expect(body["countryCode"], "NG");
        expect(body["preferredLocale"], "ha");
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
              "countryCode": "NG",
              "preferredLocale": "ha",
              "effectivePreferredLocale": "ha",
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
        "countryCode": "NG",
        "preferredLocale": "ha",
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
        expect(request.url.path,
            endsWith(TheEyeApiPaths.usersMeEmergencyContacts));
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

  test("requestAccountDeletion posts intentional permanent confirmation",
      () async {
    final client = TheEyeApiClient(
      baseUrl: "https://api.test/v1",
      httpClient: MockClient((request) async {
        expect(request.method, "POST");
        expect(
            request.url.path, endsWith(TheEyeApiPaths.usersMeDeletionRequest));
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        expect(body["confirm"], isTrue);
        expect(body["confirmation"], "DELETE");
        expect(body["currentPassword"], "Password123!");
        return http.Response(
          jsonEncode({
            "ok": true,
            "status": "Deleted",
            "message": "done",
          }),
          200,
          headers: {"content-type": "application/json"},
        );
      }),
    );

    final result = await client.requestAccountDeletion(
      accessToken: "token",
      confirmation: "DELETE",
      currentPassword: "Password123!",
    );
    expect(result["ok"], isTrue);
    expect(result["status"], "Deleted");
  });

  test("vehicle garage endpoints support list/create/set primary/delete/photos",
      () async {
    final calls = <String>[];
    final client = TheEyeApiClient(
      baseUrl: "https://api.test/v1",
      httpClient: MockClient((request) async {
        calls.add("${request.method} ${request.url.path}");
        if (request.method == "GET" &&
            request.url.path.endsWith(TheEyeApiPaths.usersMeVehicles)) {
          return http.Response(
            jsonEncode({
              "data": [
                {
                  "id": "v1",
                  "userId": "u1",
                  "make": "Toyota",
                  "model": "Corolla",
                  "plateNumber": "ABC-111",
                  "isPrimary": true,
                  "photos": [
                    {
                      "id": "p1",
                      "objectKey": "vehicles/u1/v1/photo.jpg",
                      "contentType": "image/jpeg",
                      "sizeBytes": 1200,
                      "sortOrder": 0,
                    }
                  ],
                }
              ]
            }),
            200,
            headers: {"content-type": "application/json"},
          );
        }
        if (request.method == "POST" &&
            request.url.path.endsWith(TheEyeApiPaths.usersMeVehicles)) {
          final body = jsonDecode(request.body) as Map<String, dynamic>;
          expect(body["make"], "Honda");
          return http.Response(
            jsonEncode({
              "id": "v2",
              "userId": "u1",
              "make": "Honda",
              "model": "Civic",
              "plateNumber": "ABC-222",
              "isPrimary": false,
            }),
            201,
            headers: {"content-type": "application/json"},
          );
        }
        if (request.method == "POST" &&
            request.url.path.endsWith("/me/vehicles/v2/primary")) {
          return http.Response(
            jsonEncode({
              "id": "v2",
              "userId": "u1",
              "make": "Honda",
              "model": "Civic",
              "plateNumber": "ABC-222",
              "isPrimary": true,
            }),
            200,
            headers: {"content-type": "application/json"},
          );
        }
        if (request.method == "DELETE" &&
            request.url.path.endsWith("/me/vehicles/v2")) {
          return http.Response("", 204);
        }
        if (request.method == "POST" &&
            request.url.path.endsWith("/me/vehicles/v2/photos/presign")) {
          final body = jsonDecode(request.body) as Map<String, dynamic>;
          expect(body["contentType"], "image/jpeg");
          return http.Response(
            jsonEncode({
              "bucket": "the-eye",
              "objectKey": "vehicles/u1/v2/upload.jpg",
              "uploadUrl": "https://upload.example/signed",
              "requiredHeaders": {"content-type": "image/jpeg"},
            }),
            200,
            headers: {"content-type": "application/json"},
          );
        }
        if (request.method == "POST" &&
            request.url.path.endsWith("/me/vehicles/v2/photos/confirm")) {
          return http.Response(
            jsonEncode({
              "id": "p2",
              "objectKey": "vehicles/u1/v2/upload.jpg",
              "contentType": "image/jpeg",
              "sizeBytes": 1111,
              "sortOrder": 1,
            }),
            201,
            headers: {"content-type": "application/json"},
          );
        }
        if (request.method == "DELETE" &&
            request.url.path.endsWith("/me/vehicles/v2/photos/p2")) {
          return http.Response("", 204);
        }
        return http.Response("Not Found", 404);
      }),
    );

    final list = await client.listMyVehicles(accessToken: "token");
    final created = await client.createMyVehicle(
      accessToken: "token",
      payload: {
        "make": "Honda",
        "model": "Civic",
        "plateNumber": "ABC-222",
      },
    );
    final primary = await client.setMyVehiclePrimary(
      accessToken: "token",
      vehicleId: "v2",
    );
    final presigned = await client.presignVehiclePhoto(
      accessToken: "token",
      vehicleId: "v2",
      contentType: "image/jpeg",
      fileName: "front.jpg",
      sizeBytes: 1111,
    );
    final confirmed = await client.confirmVehiclePhoto(
      accessToken: "token",
      vehicleId: "v2",
      objectKey: "vehicles/u1/v2/upload.jpg",
      contentType: "image/jpeg",
      angle: "FRONT",
      sizeBytes: 1111,
      sortOrder: 1,
    );
    await client.deleteVehiclePhoto(
      accessToken: "token",
      vehicleId: "v2",
      photoId: "p2",
    );
    await client.deleteMyVehicle(accessToken: "token", vehicleId: "v2");

    expect(list, hasLength(1));
    expect(list.first.photos, hasLength(1));
    expect(created.id, "v2");
    expect(primary.isPrimary, isTrue);
    expect(presigned.objectKey, contains("vehicles/u1/v2"));
    expect(confirmed.id, "p2");
    expect(confirmed.angle, "OTHER");
    expect(
      calls,
      containsAll([
        "GET /v1/me/vehicles",
        "POST /v1/me/vehicles",
        "POST /v1/me/vehicles/v2/primary",
        "POST /v1/me/vehicles/v2/photos/presign",
        "POST /v1/me/vehicles/v2/photos/confirm",
        "DELETE /v1/me/vehicles/v2/photos/p2",
        "DELETE /v1/me/vehicles/v2",
      ]),
    );
  });
}
