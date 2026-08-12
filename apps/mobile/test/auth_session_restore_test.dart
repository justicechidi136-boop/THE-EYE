import "dart:convert";
import "dart:io";

import "package:flutter_test/flutter_test.dart";
import "package:http/http.dart" as http;
import "package:http/testing.dart";

import "package:the_eye_mobile/auth/auth_service.dart";
import "package:the_eye_mobile/auth/auth_session_store.dart";
import "package:the_eye_mobile/contracts/the_eye_api_client.dart";
import "package:the_eye_mobile/contracts/the_eye_api_paths.dart";

void main() {
  group("AuthService session restore", () {
    test("returns unauthenticated when no persisted session exists", () async {
      final service = AuthService(
        apiClient: TheEyeApiClient(httpClient: MockClient((_) async {
          return http.Response("{}", 404);
        })),
        sessionStore: InMemoryAuthSessionStore(),
      );

      final result = await service.restorePersistedSession();

      expect(result.status, SessionRestoreStatus.unauthenticated);
    });

    test("restores a valid persisted session from profile lookup", () async {
      final store = InMemoryAuthSessionStore();
      await store.save(
        const AuthSession(
          accessToken: "access-token",
          refreshToken: "refresh-token",
        ),
      );

      final client = TheEyeApiClient(
        httpClient: MockClient((request) async {
          if (request.url.path.endsWith(TheEyeApiPaths.usersMe)) {
            return http.Response(
              jsonEncode({
                "id": "user-1",
                "displayName": "Ada Okeke",
                "kycStatus": "Unverified",
                "profile": {
                  "firstName": "Ada",
                  "lastName": "Okeke",
                  "country": "Nigeria",
                  "state": "Lagos",
                  "lga": "Ikeja",
                },
              }),
              200,
            );
          }
          return http.Response("{}", 404);
        }),
      );

      final service = AuthService(apiClient: client, sessionStore: store);
      final result = await service.restorePersistedSession();

      expect(result.status, SessionRestoreStatus.restored);
      expect(result.session?.accessToken, "access-token");
    });

    test("refreshes expired access tokens before restoring session", () async {
      final store = InMemoryAuthSessionStore();
      await store.save(
        const AuthSession(
          accessToken: "expired-access",
          refreshToken: "refresh-token",
        ),
      );

      var profileCalls = 0;
      final client = TheEyeApiClient(
        httpClient: MockClient((request) async {
          if (request.url.path.endsWith(TheEyeApiPaths.usersMe)) {
            profileCalls += 1;
            if (profileCalls == 1) {
              return http.Response(
                  jsonEncode({"message": "Unauthorized"}), 401);
            }
            return http.Response(
              jsonEncode({
                "id": "user-1",
                "displayName": "Ada Okeke",
                "kycStatus": "Unverified",
                "profile": {
                  "firstName": "Ada",
                  "lastName": "Okeke",
                  "country": "Nigeria",
                  "state": "Lagos",
                  "lga": "Ikeja",
                },
              }),
              200,
            );
          }
          if (request.url.path.endsWith(TheEyeApiPaths.authRefresh)) {
            return http.Response(
              jsonEncode({
                "accessToken": "fresh-access",
                "refreshToken": "fresh-refresh",
              }),
              200,
            );
          }
          return http.Response("{}", 404);
        }),
      );

      final service = AuthService(apiClient: client, sessionStore: store);
      final result = await service.restorePersistedSession();

      expect(result.status, SessionRestoreStatus.restored);
      expect(result.session?.accessToken, "fresh-access");
      expect((await store.load())?.accessToken, "fresh-access");
      expect(profileCalls, 2);
    });

    test("clears session when refresh token is invalid", () async {
      final store = InMemoryAuthSessionStore();
      await store.save(
        const AuthSession(
          accessToken: "expired-access",
          refreshToken: "invalid-refresh",
        ),
      );

      final client = TheEyeApiClient(
        httpClient: MockClient((request) async {
          if (request.url.path.endsWith(TheEyeApiPaths.usersMe)) {
            return http.Response(jsonEncode({"message": "Unauthorized"}), 401);
          }
          if (request.url.path.endsWith(TheEyeApiPaths.authRefresh)) {
            return http.Response(
                jsonEncode({"message": "Invalid refresh token"}), 401);
          }
          return http.Response("{}", 404);
        }),
      );

      final service = AuthService(apiClient: client, sessionStore: store);
      final result = await service.restorePersistedSession();

      expect(result.status, SessionRestoreStatus.failed);
      expect(await store.load(), isNull);
    });

    test("routes incomplete profiles to profile completion state", () async {
      final store = InMemoryAuthSessionStore();
      await store.save(
        const AuthSession(
          accessToken: "access-token",
          refreshToken: "refresh-token",
        ),
      );

      final client = TheEyeApiClient(
        httpClient: MockClient((request) async {
          if (request.url.path.endsWith(TheEyeApiPaths.usersMe)) {
            return http.Response(
              jsonEncode({
                "id": "user-1",
                "displayName": "Ada Okeke",
                "kycStatus": "Unverified",
                "profile": {
                  "firstName": "Ada",
                  "lastName": "Okeke",
                },
              }),
              200,
            );
          }
          return http.Response("{}", 404);
        }),
      );

      final service = AuthService(apiClient: client, sessionStore: store);
      final result = await service.restorePersistedSession();

      expect(result.status, SessionRestoreStatus.profileIncomplete);
      expect(result.session?.accessToken, "access-token");
    });

    test("treats malformed stored sessions as unauthenticated", () async {
      final store = InMemoryAuthSessionStore();
      await store.save(
        const AuthSession(accessToken: "", refreshToken: "refresh-token"),
      );

      final service = AuthService(
        apiClient: TheEyeApiClient(httpClient: MockClient((_) async {
          return http.Response("{}", 404);
        })),
        sessionStore: store,
      );

      final result = await service.restorePersistedSession();
      expect(result.status, SessionRestoreStatus.unauthenticated);
    });

    test("preserves offline session without network validation", () async {
      final store = InMemoryAuthSessionStore();
      await store.save(
        const AuthSession(
          accessToken: "access-token",
          refreshToken: "refresh-token",
        ),
      );

      final service = AuthService(
        apiClient: TheEyeApiClient(httpClient: MockClient((_) async {
          throw const SocketException("offline");
        })),
        sessionStore: store,
      );

      final result = await service.restorePersistedSession();
      expect(result.status, SessionRestoreStatus.restored);
      expect(result.session?.accessToken, "access-token");
    });

    test("logout clears local session after restart simulation", () async {
      final store = InMemoryAuthSessionStore();
      await store.save(
        const AuthSession(
          accessToken: "access-token",
          refreshToken: "refresh-token",
        ),
      );

      String? logoutBody;
      final client = TheEyeApiClient(
        httpClient: MockClient((request) async {
          if (request.url.path.endsWith(TheEyeApiPaths.authLogout)) {
            logoutBody = request.body;
            return http.Response(jsonEncode({"ok": true}), 200);
          }
          return http.Response("{}", 404);
        }),
      );

      final service = AuthService(apiClient: client, sessionStore: store);
      await service.logout();

      expect(await store.load(), isNull);
      expect(jsonDecode(logoutBody!), {"refreshToken": "refresh-token"});

      final restore = await service.restorePersistedSession();
      expect(restore.status, SessionRestoreStatus.unauthenticated);
    });

    test("refreshSessionSingleFlight coalesces concurrent refresh calls",
        () async {
      final store = InMemoryAuthSessionStore();
      await store.save(
        const AuthSession(
          accessToken: "expired-access",
          refreshToken: "refresh-token",
        ),
      );

      var refreshCalls = 0;
      final client = TheEyeApiClient(
        httpClient: MockClient((request) async {
          if (request.url.path.endsWith(TheEyeApiPaths.authRefresh)) {
            refreshCalls += 1;
            await Future<void>.delayed(const Duration(milliseconds: 50));
            return http.Response(
              jsonEncode({
                "accessToken": "fresh-access-$refreshCalls",
                "refreshToken": "fresh-refresh-$refreshCalls",
              }),
              200,
            );
          }
          return http.Response("{}", 404);
        }),
      );

      final service = AuthService(apiClient: client, sessionStore: store);
      final results = await Future.wait([
        service.refreshSessionSingleFlight(),
        service.refreshSessionSingleFlight(),
        service.refreshSessionSingleFlight(),
      ]);

      expect(refreshCalls, 1);
      expect(
          results.every((session) => session?.accessToken == "fresh-access-1"),
          isTrue);
      expect((await store.load())?.accessToken, "fresh-access-1");
    });

    test("withAuthorizedRetry refreshes once on 401 and retries action",
        () async {
      final store = InMemoryAuthSessionStore();
      await store.save(
        const AuthSession(
          accessToken: "expired-access",
          refreshToken: "refresh-token",
        ),
      );

      var actionCalls = 0;
      final client = TheEyeApiClient(
        httpClient: MockClient((request) async {
          if (request.url.path.endsWith(TheEyeApiPaths.authRefresh)) {
            return http.Response(
              jsonEncode({
                "accessToken": "fresh-access",
                "refreshToken": "fresh-refresh",
              }),
              200,
            );
          }
          return http.Response("{}", 404);
        }),
      );

      final service = AuthService(apiClient: client, sessionStore: store);
      final result =
          await service.withAuthorizedRetry<String>((accessToken) async {
        actionCalls += 1;
        if (accessToken == "expired-access") {
          throw AuthApiException(401, "Unauthorized");
        }
        return "ok-$accessToken";
      });

      expect(result, "ok-fresh-access");
      expect(actionCalls, 2);
      expect((await store.load())?.accessToken, "fresh-access");
    });
  });

  group("TheEyeApiClient unauthorized refresh callback", () {
    test("concurrent 401 responses trigger one single-flight refresh",
        () async {
      final store = InMemoryAuthSessionStore();
      await store.save(
        const AuthSession(
          accessToken: "expired-access",
          refreshToken: "refresh-token",
        ),
      );

      var profileCalls = 0;
      var refreshCalls = 0;
      late AuthService authService;
      final client = TheEyeApiClient(
        httpClient: MockClient((request) async {
          if (request.url.path.endsWith(TheEyeApiPaths.usersMe)) {
            profileCalls += 1;
            final token = request.headers["authorization"];
            if (token == "Bearer expired-access") {
              return http.Response(
                  jsonEncode({"message": "Unauthorized"}), 401);
            }
            return http.Response(
              jsonEncode({
                "id": "user-1",
                "displayName": "Citizen",
                "kycStatus": "Unverified",
                "profile": {
                  "firstName": "Ada",
                  "lastName": "Okeke",
                  "country": "Nigeria",
                  "state": "Lagos",
                  "lga": "Ikeja",
                },
              }),
              200,
            );
          }
          if (request.url.path.endsWith(TheEyeApiPaths.authRefresh)) {
            refreshCalls += 1;
            await Future<void>.delayed(const Duration(milliseconds: 30));
            return http.Response(
              jsonEncode({
                "accessToken": "fresh-access",
                "refreshToken": "fresh-refresh",
              }),
              200,
            );
          }
          return http.Response("{}", 404);
        }),
        onUnauthorizedRefresh: () async {
          final refreshed = await authService.refreshSessionSingleFlight();
          return refreshed?.accessToken;
        },
      );
      authService = AuthService(apiClient: client, sessionStore: store);

      final responses = await Future.wait([
        client.getJson(TheEyeApiPaths.usersMe, accessToken: "expired-access"),
        client.getJson(TheEyeApiPaths.usersMe, accessToken: "expired-access"),
      ]);

      expect(refreshCalls, 1);
      expect(profileCalls, 4);
      expect(responses.every((response) => response.statusCode == 200), isTrue);
      expect((await store.load())?.accessToken, "fresh-access");
    });

    test("retries once with refreshed token after 401", () async {
      final store = InMemoryAuthSessionStore();
      await store.save(
        const AuthSession(
          accessToken: "expired-access",
          refreshToken: "refresh-token",
        ),
      );

      late AuthService authService;
      final client = TheEyeApiClient(
        httpClient: MockClient((request) async {
          if (request.url.path.endsWith(TheEyeApiPaths.usersMe)) {
            final token = request.headers["authorization"];
            if (token == "Bearer expired-access") {
              return http.Response(
                  jsonEncode({"message": "Unauthorized"}), 401);
            }
            return http.Response(jsonEncode({"id": "user-1"}), 200);
          }
          if (request.url.path.endsWith(TheEyeApiPaths.authRefresh)) {
            return http.Response(
              jsonEncode({
                "accessToken": "fresh-access",
                "refreshToken": "fresh-refresh",
              }),
              200,
            );
          }
          return http.Response("{}", 404);
        }),
        onUnauthorizedRefresh: () async {
          final refreshed = await authService.refreshSessionSingleFlight();
          return refreshed?.accessToken;
        },
      );
      authService = AuthService(apiClient: client, sessionStore: store);

      final response = await client.getJson(TheEyeApiPaths.usersMe,
          accessToken: "expired-access");

      expect(response.statusCode, 200);
      expect((await store.load())?.accessToken, "fresh-access");
    });

    test("invalid refresh clears stored session and returns original 401",
        () async {
      final store = InMemoryAuthSessionStore();
      await store.save(
        const AuthSession(
          accessToken: "expired-access",
          refreshToken: "invalid-refresh",
        ),
      );

      late AuthService authService;
      final client = TheEyeApiClient(
        httpClient: MockClient((request) async {
          if (request.url.path.endsWith(TheEyeApiPaths.usersMe)) {
            return http.Response(jsonEncode({"message": "Unauthorized"}), 401);
          }
          if (request.url.path.endsWith(TheEyeApiPaths.authRefresh)) {
            return http.Response(
                jsonEncode({"message": "Invalid refresh token"}), 401);
          }
          return http.Response("{}", 404);
        }),
        onUnauthorizedRefresh: () async {
          final refreshed = await authService.refreshSessionSingleFlight();
          return refreshed?.accessToken;
        },
      );
      authService = AuthService(apiClient: client, sessionStore: store);

      final response = await client.getJson(TheEyeApiPaths.usersMe,
          accessToken: "expired-access");

      expect(response.statusCode, 401);
      expect(await store.load(), isNull);
    });

    test("does not auto-refresh auth refresh endpoint calls", () async {
      var unauthorizedRefreshCalls = 0;
      final client = TheEyeApiClient(
        httpClient: MockClient((request) async {
          if (request.url.path.endsWith(TheEyeApiPaths.authRefresh)) {
            return http.Response(jsonEncode({"message": "Unauthorized"}), 401);
          }
          return http.Response("{}", 404);
        }),
        onUnauthorizedRefresh: () async {
          unauthorizedRefreshCalls += 1;
          return "fresh-access";
        },
      );

      final response = await client.postJson(
        TheEyeApiPaths.authRefresh,
        {"refreshToken": "refresh-token"},
        accessToken: "expired-access",
      );

      expect(response.statusCode, 401);
      expect(unauthorizedRefreshCalls, 0);
    });
  });
}
