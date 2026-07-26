import {
  normalizeStagingCredentialEmail,
  normalizeStagingCredentialPassword,
  readStagingTestCredentials,
} from "../../prisma/staging-test-accounts.config";

describe("staging test account credentials", () => {
  it("normalizes email and trims password whitespace from env values", () => {
    const accounts = readStagingTestCredentials({
      STAGING_TEST_CITIZEN_EMAIL: "  Staging.Citizen@theeye.local \n",
      STAGING_TEST_CITIZEN_PASSWORD: " changeme-staging-citizen \r\n",
    });

    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.key).toBe("CITIZEN");
    expect(accounts[0]?.email).toBe("staging.citizen@theeye.local");
    expect(accounts[0]?.password).toBe("changeme-staging-citizen");
  });

  it("exports shared normalization helpers for seed and login", () => {
    expect(normalizeStagingCredentialEmail("  A@B.COM ")).toBe("a@b.com");
    expect(normalizeStagingCredentialPassword(" secret \n")).toBe("secret");
  });

  it("preserves meaningful internal password characters after trim", () => {
    expect(normalizeStagingCredentialPassword("  pa ss!word  ")).toBe("pa ss!word");
  });

  it("never exposes password values in serialized account output", () => {
    const accounts = readStagingTestCredentials({
      STAGING_TEST_CITIZEN_EMAIL: "staging.citizen@theeye.local",
      STAGING_TEST_CITIZEN_PASSWORD: "secret-value",
    });
    const serialized = JSON.stringify(accounts);
    expect(serialized).toContain("staging.citizen@theeye.local");
    expect(serialized).not.toContain("secret-value");
  });
});
