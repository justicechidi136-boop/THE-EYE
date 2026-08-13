import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/auth/citizen_auth_return_link.dart";
import "package:the_eye_mobile/config/app_flavor.dart";

void main() {
  group("AUTH-007 CitizenAuthReturnLink", () {
    test("staging scheme matches staging package flavor when defined", () {
      if (const String.fromEnvironment("THE_EYE_FLAVOR") == "staging") {
        expect(CitizenAuthReturnLink.scheme, "theeye-staging");
      }
      if (const String.fromEnvironment("THE_EYE_FLAVOR") == "production") {
        expect(CitizenAuthReturnLink.scheme, "theeye");
        expect(AppFlavorConfig.current, AppFlavor.production);
      }
    });

    test("accepts password-reset success return URI for staging scheme", () {
      final uri = CitizenAuthReturnLink.buildReturnUri(
        "PASSWORD_RESET_SUCCESS",
        forScheme: "theeye-staging",
      );
      expect(
        CitizenAuthReturnLink.isCitizenAuthReturnUri(
          uri,
          expectedScheme: "theeye-staging",
        ),
        isTrue,
      );
      expect(
        CitizenAuthReturnLink.resolveSignInMessage(
          uri,
          expectedScheme: "theeye-staging",
        ),
        contains("Password updated"),
      );
      expect(uri.queryParameters.containsKey("token"), isFalse);
    });

    test("accepts account-recovery success return URI", () {
      final uri = Uri.parse(
        "theeye://auth/login?result=ACCOUNT_RECOVERY_SUCCESS",
      );
      expect(
        CitizenAuthReturnLink.resolveSignInMessage(
          uri,
          expectedScheme: "theeye",
        ),
        contains("Account recovery"),
      );
    });

    test("rejects wrong scheme (field/admin/other flavor)", () {
      final wrong = Uri.parse(
        "theeye-staging://auth/login?result=PASSWORD_RESET_SUCCESS",
      );
      expect(
        CitizenAuthReturnLink.resolveSignInMessage(
          wrong,
          expectedScheme: "theeye",
        ),
        isNull,
      );
    });

    test("rejects invalid host/path safely", () {
      expect(
        CitizenAuthReturnLink.resolveSignInMessage(
          Uri.parse("theeye-staging://admin/login"),
          expectedScheme: "theeye-staging",
        ),
        isNull,
      );
      expect(
        CitizenAuthReturnLink.resolveSignInMessage(
          Uri.parse("theeye-staging://auth/other"),
          expectedScheme: "theeye-staging",
        ),
        isNull,
      );
    });

    test("forbids admin dashboard login destinations", () {
      expect(
        CitizenAuthReturnLink.isForbiddenAdminDestination(
          Uri.parse("https://staging-dashboard8jps.theeye.com.ng/login"),
        ),
        isTrue,
      );
      expect(
        CitizenAuthReturnLink.isForbiddenAdminDestination(
          Uri.parse("theeye-staging://auth/login?result=PASSWORD_RESET_SUCCESS"),
        ),
        isFalse,
      );
    });

    test("unknown result still returns safe sign-in message", () {
      final uri = Uri.parse("theeye-staging://auth/login?result=WEIRD");
      expect(
        CitizenAuthReturnLink.resolveSignInMessage(
          uri,
          expectedScheme: "theeye-staging",
        ),
        "Return to THE EYE and sign in.",
      );
    });

    test("canonical sign-in route is existing /login", () {
      expect(CitizenAuthReturnLink.signInRoute, "/login");
    });
  });
}
