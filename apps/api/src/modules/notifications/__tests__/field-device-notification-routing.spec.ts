import {
  buildFieldDeviceNotificationMetadata,
  resolveFieldDeviceNotificationRouting,
} from "../notification-routing.schema";

describe("field device notification routing", () => {
  it("builds FIELD_DEVICE_APPROVED metadata without credentials", () => {
    const metadata = buildFieldDeviceNotificationMetadata({
      publicDeviceId: "fd_test123",
      notificationType: "FIELD_DEVICE_APPROVED",
    });
    expect(metadata.schemaVersion).toBe(1);
    expect(metadata.routeType).toBe("FIELD_DEVICE_STATUS");
    expect(metadata.destination).toBe("/device-registration");
    expect(metadata.publicDeviceId).toBe("fd_test123");
    expect(metadata.accessToken).toBeUndefined();
    expect(metadata.refreshToken).toBeUndefined();
  });

  it("resolves FIELD_SESSION_REVOKED routing", () => {
    const routing = resolveFieldDeviceNotificationRouting({
      publicDeviceId: "fd_test123",
      notificationType: "FIELD_SESSION_REVOKED",
    });
    expect(routing.notificationType).toBe("FIELD_SESSION_REVOKED");
    expect(routing.routeType).toBe("FIELD_DEVICE_STATUS");
  });
});
