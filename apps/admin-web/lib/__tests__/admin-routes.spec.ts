import {
  ADMIN_ROUTE_REGISTRY,
  csocNavItems,
  getRouteById,
  getRouteByPath,
  isLegacyPath,
  liveChatPathsConflict,
  mainNavGroups,
  resolveCanonicalPath,
  routeAllowedForRole,
  routeRequiresPermission,
} from "../admin/admin-route-registry";
import { CSOC_NAV_ITEMS } from "../csoc/nav";
import { AdminRoleName } from "@the-eye/shared";

describe("admin route registry", () => {
  it("defines all 13 primary management capabilities", () => {
    const ids = new Set(ADMIN_ROUTE_REGISTRY.map((route) => route.id));
    for (const id of [
      "incident-centre",
      "live-chat",
      "community-chat",
      "agency-dispatch",
      "emergency-command",
      "missing-persons",
      "stolen-vehicles",
      "broadcasts",
      "community-registry",
      "membership-approval",
      "patrol",
      "volunteers",
      "users",
    ]) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it("resolves legacy paths to canonical routes", () => {
    expect(resolveCanonicalPath("/neighborhood-watch/incidents")).toBe("/incidents");
    expect(resolveCanonicalPath("/neighborhood-watch/missing-persons")).toBe("/missing-persons");
    expect(resolveCanonicalPath("/neighborhood-watch/stolen-vehicles")).toBe("/stolen-vehicles");
    expect(resolveCanonicalPath("/neighborhood-watch/broadcasts")).toBe("/broadcasts");
    expect(isLegacyPath("/neighborhood-watch/incidents")).toBe(true);
    expect(isLegacyPath("/incidents")).toBe(false);
  });

  it("keeps Live Chat separate from Community Chat", () => {
    const live = getRouteById("live-chat");
    const community = getRouteById("community-chat");
    expect(live?.canonicalPath).toBe("/live-chats");
    expect(community?.canonicalPath).toBe("/neighborhood-watch/chat");
    expect(live?.canonicalPath === community?.canonicalPath).toBe(false);
    expect(liveChatPathsConflict("/live-chats")).toBe(false);
    expect(resolveCanonicalPath("/live-chats")).toBe("/live-chats");
  });

  it("maps menu items to intended canonical routes", () => {
    const mainItems = mainNavGroups().flatMap((group) => group.items);
    expect(mainItems.find((item) => item.routeId === "live-chat")?.href).toBe("/live-chats");
    expect(mainItems.find((item) => item.routeId === "incident-centre")?.href).toBe("/incidents");
    expect(mainItems.find((item) => item.routeId === "users")?.href).toBe("/users");

    const csocItems = csocNavItems();
    expect(csocItems.find((item) => item.routeId === "incident-centre")?.href).toBe("/incidents");
    expect(csocItems.find((item) => item.routeId === "community-chat")?.href).toBe("/neighborhood-watch/chat");
  });

  it("registers Neighborhood Watch shell with rebranded dashboard label", () => {
    expect(CSOC_NAV_ITEMS.find((item) => item.href === "/neighborhood-watch")?.label).toBe(
      "Community Safety Dashboard",
    );
    for (const id of ["community-registry", "membership-approval", "patrol", "volunteers", "community-chat"]) {
      expect(getRouteById(id)?.canonicalPath.startsWith("/neighborhood-watch")).toBe(true);
    }
  });

  it("uses consistent permissions between shells for shared routes", () => {
    const incident = getRouteById("incident-centre");
    expect(incident?.shell).toBe("both");
    expect(routeRequiresPermission(incident!, ["incident:read"])).toBe(true);
    expect(routeRequiresPermission(incident!, ["broadcast:create"])).toBe(false);
  });

  it("does not assign duplicate labels to conflicting implementations", () => {
    const byLabel = new Map<string, string>();
    for (const route of ADMIN_ROUTE_REGISTRY) {
      const existing = byLabel.get(route.label);
      if (existing) {
        expect(existing).toBe(route.canonicalPath);
      } else {
        byLabel.set(route.label, route.canonicalPath);
      }
    }
  });

  it("restricts user management to scoped admin roles when configured", () => {
    const users = getRouteById("users")!;
    expect(routeAllowedForRole(users, AdminRoleName.SuperAdmin)).toBe(true);
    expect(routeAllowedForRole(users, AdminRoleName.CommunityModerator)).toBe(false);
  });

  it("resolves detail paths by canonical prefix", () => {
    expect(getRouteByPath("/incidents/abc-123")?.id).toBe("incident-centre");
    expect(getRouteByPath("/live-chats/conv-1")?.id).toBe("live-chat");
  });
});
