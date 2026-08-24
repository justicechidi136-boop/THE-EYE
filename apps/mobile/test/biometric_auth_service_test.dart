import "package:flutter_test/flutter_test.dart";
import "package:local_auth/local_auth.dart";

import "package:the_eye_mobile/auth/biometric_auth_service.dart";

void main() {
  test("reports fingerprint and face capabilities without authenticating",
      () async {
    final fingerprint = BiometricAuthService(
      gateway: _FakeGateway(enrolled: const [BiometricType.fingerprint]),
    );
    final face = BiometricAuthService(
      gateway: _FakeGateway(enrolled: const [BiometricType.face]),
    );

    expect((await fingerprint.capability()).kind, BiometricKind.fingerprint);
    expect((await face.capability()).kind, BiometricKind.face);
  });

  test("does not prompt when biometrics are unavailable or not enrolled",
      () async {
    final unavailableGateway = _FakeGateway(supported: false);
    final emptyGateway = _FakeGateway();

    expect(
      await BiometricAuthService(gateway: unavailableGateway).authenticate(),
      BiometricAuthenticationStatus.unavailable,
    );
    expect(
      await BiometricAuthService(gateway: emptyGateway).authenticate(),
      BiometricAuthenticationStatus.notEnrolled,
    );
    expect(unavailableGateway.authenticationCalls, 0);
    expect(emptyGateway.authenticationCalls, 0);
  });

  test("maps native success, rejection, cancellation, and lockout", () async {
    Future<BiometricAuthenticationStatus> run(Object result) {
      return BiometricAuthService(
        gateway: _FakeGateway(
          enrolled: const [BiometricType.strong],
          authenticationResult: result,
        ),
      ).authenticate();
    }

    expect(await run(true), BiometricAuthenticationStatus.success);
    expect(await run(false), BiometricAuthenticationStatus.failed);
    expect(
      await run(
        const LocalAuthException(code: LocalAuthExceptionCode.userCanceled),
      ),
      BiometricAuthenticationStatus.cancelled,
    );
    expect(
      await run(
        const LocalAuthException(
          code: LocalAuthExceptionCode.biometricLockout,
        ),
      ),
      BiometricAuthenticationStatus.lockedOut,
    );
  });

  test("maps changed enrollment and provider errors safely", () async {
    final notEnrolled = BiometricAuthService(
      gateway: _FakeGateway(
        enrolled: const [BiometricType.strong],
        authenticationResult: const LocalAuthException(
          code: LocalAuthExceptionCode.noBiometricsEnrolled,
        ),
      ),
    );
    final providerError = BiometricAuthService(
      gateway: _FakeGateway(
        enrolled: const [BiometricType.strong],
        authenticationResult: StateError("provider failed"),
      ),
    );

    expect(
      await notEnrolled.authenticate(),
      BiometricAuthenticationStatus.notEnrolled,
    );
    expect(
      await providerError.authenticate(),
      BiometricAuthenticationStatus.error,
    );
  });
}

class _FakeGateway implements DeviceBiometricGateway {
  _FakeGateway({
    this.supported = true,
    this.enrolled = const [],
    this.authenticationResult = true,
  });

  final bool supported;
  final List<BiometricType> enrolled;
  final Object authenticationResult;
  int authenticationCalls = 0;

  @override
  Future<bool> supportsBiometrics() async => supported;

  @override
  Future<List<BiometricType>> enrolledBiometrics() async => enrolled;

  @override
  Future<bool> authenticate({required String reason}) async {
    authenticationCalls += 1;
    final result = authenticationResult;
    if (result is Exception) throw result;
    if (result is Error) throw result;
    return result as bool;
  }
}
