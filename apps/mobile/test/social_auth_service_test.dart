import "package:firebase_auth/firebase_auth.dart";
import "package:flutter/services.dart";
import "package:the_eye_mobile/auth/auth_session_store.dart";
import "package:the_eye_mobile/auth/auth_service.dart";
import "package:the_eye_mobile/auth/social_auth_service.dart";
import "package:the_eye_mobile/contracts/the_eye_api_client.dart";
import "package:flutter_test/flutter_test.dart";

import "support/fake_google_sign_in.dart";

class _FakeFirebaseAuth implements FirebaseAuth {
  @override
  Future<void> signOut() async {}

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _FakeUser implements User {
  _FakeUser(this._idToken);

  final String _idToken;

  @override
  Future<String?> getIdToken([bool forceRefresh = false]) async => _idToken;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _FakeUserCredential implements UserCredential {
  _FakeUserCredential(this.user);

  @override
  final User? user;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _FakeApiClient extends TheEyeApiClient {
  _FakeApiClient({required this.onExchange});

  final Future<AuthExchangeResult> Function() onExchange;

  @override
  Future<AuthExchangeResult> exchangeFirebaseToken({
    required String idToken,
    required String provider,
    String? deviceId,
    String? platform,
    Duration timeout = const Duration(seconds: 30),
  }) {
    return onExchange();
  }
}

void main() {
  test("duplicate social sign-in taps are ignored while in flight", () async {
    var exchangeCalls = 0;
    final service = SocialAuthService(
      apiClient: _FakeApiClient(
        onExchange: () async {
          exchangeCalls += 1;
          return const AuthExchangeResult(
            session:
                AuthSession(accessToken: "access", refreshToken: "refresh"),
            profileComplete: true,
          );
        },
      ),
      sessionStore: InMemoryAuthSessionStore(),
      firebaseAuth: _FakeFirebaseAuth(),
      googleSignIn: FakeGoogleSignIn(),
      googleCredentialFactory: () async {
        await Future<void>.delayed(const Duration(milliseconds: 100));
        return _FakeUserCredential(_FakeUser("firebase-id-token"));
      },
    );

    final first = service.signInWithGoogle();
    final second = service.signInWithGoogle();
    final results = await Future.wait([first, second]);

    expect(exchangeCalls, 1);
    expect(results.first.isSuccess, isTrue);
    expect(
      results.last.status,
      SocialAuthStatus.providerError,
    );
  });

  test("google cancellation does not surface as a generic failure", () async {
    final service = SocialAuthService(
      apiClient: _FakeApiClient(
        onExchange: () async => const AuthExchangeResult(
          session: AuthSession(accessToken: "access", refreshToken: "refresh"),
          profileComplete: true,
        ),
      ),
      sessionStore: InMemoryAuthSessionStore(),
      firebaseAuth: _FakeFirebaseAuth(),
      googleSignIn: FakeGoogleSignIn(),
      googleCredentialFactory: () async => null,
    );

    final result = await service.signInWithGoogle();
    expect(result.status, SocialAuthStatus.cancelled);
    expect(result.userMessage, "Google sign-in was cancelled.");
  });

  test("google configuration errors stay user friendly", () async {
    final service = SocialAuthService(
      apiClient: _FakeApiClient(
        onExchange: () async => const AuthExchangeResult(
          session: AuthSession(accessToken: "access", refreshToken: "refresh"),
          profileComplete: true,
        ),
      ),
      sessionStore: InMemoryAuthSessionStore(),
      firebaseAuth: _FakeFirebaseAuth(),
      googleSignIn: FakeGoogleSignIn(),
      googleCredentialFactory: () async {
        throw PlatformException(code: "10", message: "Developer error");
      },
    );

    final result = await service.signInWithGoogle();
    expect(result.status, SocialAuthStatus.providerError);
    expect(result.userMessage, contains("not fully configured"));
  });

  test("android GenericIdp unknown error triggers google_sign_in fallback", () {
    expect(
      SocialAuthService.shouldFallbackToGoogleSignInPlugin("unknown"),
      isTrue,
    );
    expect(
      SocialAuthService.shouldFallbackToGoogleSignInPlugin("internal-error"),
      isTrue,
    );
    expect(
      SocialAuthService.shouldFallbackToGoogleSignInPlugin("app-not-authorized"),
      isFalse,
    );
  });

  test("backend exchange failures surface AUTH-GOOGLE-004", () async {
    final service = SocialAuthService(
      apiClient: _FakeApiClient(
        onExchange: () async {
          throw AuthApiException(
            503,
            "Service unavailable",
            errorCode: "SERVER_ERROR",
          );
        },
      ),
      sessionStore: InMemoryAuthSessionStore(),
      firebaseAuth: _FakeFirebaseAuth(),
      googleSignIn: FakeGoogleSignIn(),
      googleCredentialFactory: () async =>
          _FakeUserCredential(_FakeUser("firebase-id-token")),
    );

    final result = await service.signInWithGoogle();
    expect(result.status, SocialAuthStatus.serverError);
    expect(
      result.userMessage,
      "We couldn't sign you in with Google. Please try again.",
    );
  });
}
