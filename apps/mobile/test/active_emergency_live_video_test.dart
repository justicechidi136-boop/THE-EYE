import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/contracts/the_eye_api_paths.dart";
import "package:the_eye_mobile/main.dart" show LiveVideoRouteArgs, LiveVideoReturnResult;

void main() {
  test("LiveVideoRouteArgs supports active emergency return flow", () {
    const args = LiveVideoRouteArgs(
      incidentId: "inc-99",
      autoStartStream: true,
      returnToActiveEmergency: true,
    );
    expect(args.incidentId, "inc-99");
    expect(args.returnToActiveEmergency, isTrue);
  });

  test("LiveVideoReturnResult carries retry message", () {
    const result = LiveVideoReturnResult(
      errorMessage: "Unable to start live video. Your emergency remains active. Retry?",
    );
    expect(result.errorMessage, contains("Retry"));
  });

  test("client-failure path is versioned under live-video sessions", () {
    expect(
      TheEyeApiPaths.liveVideoClientFailure("sess-1"),
      "/live-video/sessions/sess-1/client-failure",
    );
  });
}
