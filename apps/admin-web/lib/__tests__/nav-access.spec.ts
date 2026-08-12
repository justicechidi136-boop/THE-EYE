import { AdminRoleName } from "@the-eye/shared";
import { canAccessRoute, filterNavItems } from "../nav-access";

describe("nav-access", () => {
  it("allows state admins to reach dispatch, verification, chat, and settings", () => {
    for (const href of ["/dispatch", "/verification", "/live-chats", "/settings", "/neighborhood-watch/chat"]) {
      expect(canAccessRoute(AdminRoleName.StateAdmin, href)).toBe(true);
    }
  });

  it("allows agency admins to reach command center and verification", () => {
    expect(canAccessRoute(AdminRoleName.AgencyAdmin, "/dispatch")).toBe(true);
    expect(canAccessRoute(AdminRoleName.AgencyAdmin, "/verification")).toBe(true);
    expect(filterNavItems(AdminRoleName.AgencyAdmin, [["Command Center", "/dispatch"]]).length).toBe(1);
  });

  it("allows community moderators to reach neighborhood watch chat and settings", () => {
    expect(canAccessRoute(AdminRoleName.CommunityModerator, "/neighborhood-watch/chat")).toBe(true);
    expect(canAccessRoute(AdminRoleName.CommunityModerator, "/settings")).toBe(true);
    expect(canAccessRoute(AdminRoleName.CommunityModerator, "/dispatch")).toBe(false);
  });

  it("exposes rebranded Neighborhood Watch nav labels under /neighborhood-watch paths", () => {
    const items = filterNavItems(AdminRoleName.StateAdmin, [
      ["Community Safety Dashboard", "/neighborhood-watch"],
      ["Communities", "/neighborhood-watch/communities"],
    ]);
    expect(items).toEqual([
      ["Community Safety Dashboard", "/neighborhood-watch"],
      ["Communities", "/neighborhood-watch/communities"],
    ]);
  });
});
