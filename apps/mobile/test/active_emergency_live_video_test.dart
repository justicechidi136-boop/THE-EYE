import "package:flutter_test/flutter_test.dart";
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
}
