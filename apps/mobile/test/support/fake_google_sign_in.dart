import "package:google_sign_in/google_sign_in.dart";

/// Test double that avoids [GoogleSignInConfig] / flavor initialization.
class FakeGoogleSignIn extends GoogleSignIn {
  FakeGoogleSignIn() : super(scopes: const []);

  @override
  Future<GoogleSignInAccount?> signOut() async => null;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}
