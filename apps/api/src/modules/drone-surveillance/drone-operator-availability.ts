import { BadRequestException } from "@nestjs/common";
import {
  DroneOperatorAccountStatus,
  DroneOperatorAvailability,
} from "@the-eye/shared";

const availabilityTransitions: Record<string, Set<string>> = {
  [DroneOperatorAvailability.Available]: new Set([
    DroneOperatorAvailability.Assigned,
    DroneOperatorAvailability.OffDuty,
    DroneOperatorAvailability.OnLeave,
    DroneOperatorAvailability.Training,
    DroneOperatorAvailability.Unavailable,
    DroneOperatorAvailability.Suspended,
  ]),
  [DroneOperatorAvailability.Assigned]: new Set([
    DroneOperatorAvailability.OnMission,
    DroneOperatorAvailability.Available,
    DroneOperatorAvailability.OffDuty,
    DroneOperatorAvailability.Unavailable,
    DroneOperatorAvailability.Suspended,
  ]),
  [DroneOperatorAvailability.OnMission]: new Set([
    DroneOperatorAvailability.Available,
    DroneOperatorAvailability.OffDuty,
    DroneOperatorAvailability.Unavailable,
  ]),
  [DroneOperatorAvailability.OffDuty]: new Set([
    DroneOperatorAvailability.Available,
    DroneOperatorAvailability.OnLeave,
    DroneOperatorAvailability.Training,
    DroneOperatorAvailability.Unavailable,
  ]),
  [DroneOperatorAvailability.OnLeave]: new Set([
    DroneOperatorAvailability.Available,
    DroneOperatorAvailability.OffDuty,
    DroneOperatorAvailability.Unavailable,
  ]),
  [DroneOperatorAvailability.Training]: new Set([
    DroneOperatorAvailability.Available,
    DroneOperatorAvailability.OffDuty,
    DroneOperatorAvailability.Unavailable,
  ]),
  [DroneOperatorAvailability.Unavailable]: new Set([
    DroneOperatorAvailability.Available,
    DroneOperatorAvailability.OffDuty,
    DroneOperatorAvailability.Training,
  ]),
  [DroneOperatorAvailability.Suspended]: new Set([
    DroneOperatorAvailability.Available,
    DroneOperatorAvailability.OffDuty,
    DroneOperatorAvailability.Unavailable,
  ]),
};

export function assertAvailabilityTransition(from: string, to: string) {
  if (from === to) return;
  const allowed = availabilityTransitions[from];
  if (!allowed?.has(to)) {
    throw new BadRequestException(`Cannot transition availability from ${from} to ${to}`);
  }
}

export function assertAccountStatusAllowsAssignment(accountStatus: string, availability: string) {
  if (accountStatus === DroneOperatorAccountStatus.Suspended) {
    throw new BadRequestException("Suspended operators cannot be assigned to missions");
  }
  if (accountStatus === DroneOperatorAccountStatus.Inactive || accountStatus === DroneOperatorAccountStatus.Rejected) {
    throw new BadRequestException("Inactive or rejected operators cannot be assigned to missions");
  }
  if (availability === DroneOperatorAvailability.Suspended || availability === DroneOperatorAvailability.OnLeave) {
    throw new BadRequestException("Operator availability does not permit mission assignment");
  }
}

export function assertAccountStatusAllowsMissionStart(accountStatus: string, availability: string) {
  assertAccountStatusAllowsAssignment(accountStatus, availability);
  if (availability !== DroneOperatorAvailability.Assigned && availability !== DroneOperatorAvailability.OnMission) {
    throw new BadRequestException("Operator must be assigned before mission start");
  }
}
