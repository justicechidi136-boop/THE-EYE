import { assertStagingRecoveryLinkBases } from "../validate-env";

describe("AUTH-001 staging recovery URL guards", () => {
  it("accepts HTTPS recovery and reset bases", () => {
    expect(() =>
      assertStagingRecoveryLinkBases({
        ACCOUNT_RECOVERY_LINK_BASE_URL: "https://staging.example.com/recover",
        PASSWORD_RESET_LINK_BASE_URL: "https://staging.example.com/reset",
      }),
    ).not.toThrow();
  });

  it("rejects HTTP recovery bases in staging", () => {
    let message = "";
    try {
      assertStagingRecoveryLinkBases({
        ACCOUNT_RECOVERY_LINK_BASE_URL: "http://staging.example.com/recover",
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("HTTPS");
  });
});
