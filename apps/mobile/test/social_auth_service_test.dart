import "package:firebase_auth/firebase_auth.dart";
import "package:the_eye_mobile/auth/auth_session_store.dart";
import "package:the_eye_mobile/auth/auth_service.dart";
import "package:the_eye_mobile/auth/social_auth_service.dart";
import "package:the_eye_mobile/contracts/the_eye_api_client.dart";
import "package:flutter_test/flutter_test.dart";

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
      googleCredentialFactory: () async => null,
    );

    final result = await service.signInWithGoogle();
    expect(result.status, SocialAuthStatus.cancelled);
    expect(result.userMessage, contains("cancelled"));
  });
}
