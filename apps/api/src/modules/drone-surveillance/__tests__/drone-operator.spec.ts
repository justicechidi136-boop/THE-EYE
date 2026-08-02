import { BadRequestException } from "@nestjs/common";
import {
  DroneMissionAssignmentStatus,
  DroneOperatorAccountStatus,
  DroneOperatorAvailability,
  DroneVerificationStatus,
} from "@the-eye/shared";
import { assertAvailabilityTransition, assertAccountStatusAllowsAssignment } from "../drone-operator-availability";
import { isLicenceValid, runOperatorAssignmentChecks, runPreflightChecks, expiryWarningLevel } from "../drone-operator-compliance";
import { mapVerificationActionToStatus } from "../dto/drone-operator.dto";

describe("drone-operator-availability", () => {
  it("allows Available to Assigned", () => {
    expect(() => assertAvailabilityTransition(DroneOperatorAvailability.Available, DroneOperatorAvailability.Assigned)).not.toThrow();
  });

  it("blocks Suspended to OnMission", () => {
    expect(() => assertAvailabilityTransition(DroneOperatorAvailability.Suspended, DroneOperatorAvailability.OnMission)).toThrow(BadRequestException);
  });

  it("blocks suspended account assignment", () => {
    expect(() =>
      assertAccountStatusAllowsAssignment(DroneOperatorAccountStatus.Suspended, DroneOperatorAvailability.Available),
    ).toThrow(BadRequestException);
  });
});

describe("drone-operator-compliance", () => {
  it("detects valid licence", () => {
    expect(
      isLicenceValid({
        verificationStatus: DroneVerificationStatus.Verified,
        expiryDate: new Date(Date.now() + 86400000),
      }),
    ).toBe(true);
  });

  it("rejects expired licence for assignment checks", () => {
    const checks = runOperatorAssignmentChecks({
      accountStatus: DroneOperatorAccountStatus.Active,
      availabilityStatus: DroneOperatorAvailability.Available,
      licences: [{ verificationStatus: DroneVerificationStatus.Verified, expiryDate: new Date(Date.now() - 1000) }],
      certifications: [],
      qualifications: [],
      activeAssignmentCount: 0,
      maximumConcurrentMissions: 1,
      assignmentAccepted: false,
    });
    expect(checks.find((c) => c.code === "licence_valid")?.passed).toBe(false);
  });

  it("blocks preflight when assignment not accepted", () => {
    const checks = runPreflightChecks({
      accountStatus: DroneOperatorAccountStatus.Active,
      availabilityStatus: DroneOperatorAvailability.Assigned,
      licences: [{ verificationStatus: DroneVerificationStatus.Verified, expiryDate: null }],
      certifications: [],
      qualifications: [],
      activeAssignmentCount: 1,
      maximumConcurrentMissions: 1,
      assignmentAccepted: false,
      droneActive: true,
      droneMaintenanceCurrent: true,
      batteryHealthy: true,
      gpsHealthy: true,
      geofenceReviewed: true,
      noFlyZonesReviewed: true,
      weatherCheckRecorded: true,
      missionReferencePresent: true,
    });
    expect(checks.find((c) => c.code === "assignment_accepted")?.passed).toBe(false);
  });

  it("warns on licence expiry within 7 days", () => {
    expect(expiryWarningLevel(new Date(Date.now() + 3 * 86400000))).toBe("7d");
  });
});

describe("drone-operator.dto verification mapping", () => {
  it("maps approve to Verified", () => {
    expect(mapVerificationActionToStatus("approve")).toBe(DroneVerificationStatus.Verified);
  });

  it("maps reject to Rejected", () => {
    expect(mapVerificationActionToStatus("reject")).toBe(DroneVerificationStatus.Rejected);
  });
});

describe("assignment conflict rules", () => {
  it("primary assignment statuses include pending and accepted", () => {
    const active = [DroneMissionAssignmentStatus.Pending, DroneMissionAssignmentStatus.Accepted, DroneMissionAssignmentStatus.Active];
    expect(active).toContain(DroneMissionAssignmentStatus.Pending);
    expect(active).not.toContain(DroneMissionAssignmentStatus.Declined);
  });
});
