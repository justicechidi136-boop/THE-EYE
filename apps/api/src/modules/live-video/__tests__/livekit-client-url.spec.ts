import { LiveVideoErrorCode } from "../live-video.errors";
import { assertClientLivekitUrl, LiveKitClientUrlError } from "../livekit-client-url";

describe("assertClientLivekitUrl", () => {
  it("accepts public staging WSS URL", () => {
    expect(assertClientLivekitUrl("wss://staging-livekit.theeye.com.ng")).toBe(
      "wss://staging-livekit.theeye.com.ng",
    );
  });

  it("rejects docker-internal hostnames", () => {
    expect(() => assertClientLivekitUrl("ws://livekit:7880")).toThrow(LiveKitClientUrlError);
    try {
      assertClientLivekitUrl("ws://livekit:7880");
    } catch (error) {
      expect(error).toBeInstanceOf(LiveKitClientUrlError);
      expect((error as LiveKitClientUrlError).code).toBe(
        LiveVideoErrorCode.CLIENT_LIVEKIT_URL_INVALID,
      );
    }
  });

  it("rejects non-WSS URLs for staging clients", () => {
    expect(() => assertClientLivekitUrl("http://staging-livekit.example.com")).toThrow(
      LiveKitClientUrlError,
    );
  });

  it("rejects private network URLs", () => {
    expect(() => assertClientLivekitUrl("wss://192.168.1.10")).toThrow(LiveKitClientUrlError);
  });
});
