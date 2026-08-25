import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "../auth-cookies";
import { createLogoutResponse } from "../logout-response";

describe("admin logout response", () => {
  it("clears the session and redirects on the public dashboard origin", () => {
    const response = createLogoutResponse();
    const cookies = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/login");
    expect(cookies).toContain(`${ACCESS_TOKEN_COOKIE}=`);
    expect(cookies).toContain(`${REFRESH_TOKEN_COOKIE}=`);
    expect(cookies).toContain("Max-Age=0");
    expect(cookies.includes("0.0.0.0")).toBe(false);
  });
});
