import "package:flutter/services.dart";
import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/auth/auth_diagnostics.dart";

void main() {
  test("maps Firebase config errors to layer 2", () {
    final snapshot =
        AuthDiagnostics.forFirebaseAuthException("app-not-authorized");
    expect(snapshot.layer, GoogleAuthFailureLayer.accountSelectionFailed);
    expect(snapshot.firebaseProjectId, isNotEmpty);
    expect(snapshot.referenceId, startsWith("GA-"));
  });

  test("maps backend 401 to verification layer", () {
    final snapshot = AuthDiagnostics.forBackendExchange(
      httpStatus: 401,
      apiErrorCode: "FIREBASE_TOKEN_PROJECT_MISMATCH",
    );
    expect(snapshot.layer, GoogleAuthFailureLayer.backendVerificationFailed);
    expect(snapshot.backendHttpStatus, "401");
  });

  test("maps Google platform DEVELOPER_ERROR to layer 2", () {
    final snapshot = AuthDiagnostics.forPlatformException(
      PlatformException(code: "10", message: "10: DEVELOPER_ERROR"),
    );
    expect(snapshot.layer, GoogleAuthFailureLayer.accountSelectionFailed);
    expect(snapshot.googleStatusCode, "10");
  });

  test("maps cancellation platform code to layer 2", () {
    final snapshot = AuthDiagnostics.forPlatformException(
      PlatformException(code: "sign_in_canceled"),
    );
    expect(snapshot.layer, GoogleAuthFailureLayer.accountSelectionFailed);
  });
}
