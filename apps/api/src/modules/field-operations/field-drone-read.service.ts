import { ForbiddenException, Injectable } from "@nestjs/common";
import type { JwtPayload } from "../../common/auth/jwt";
import { DroneSurveillanceService } from "../drone-surveillance/drone-surveillance.service";
import { assertFieldSession } from "./field-session.util";

@Injectable()
export class FieldDroneReadService {
  constructor(private readonly drones: DroneSurveillanceService) {}

  async listOperationalMissions(actor: JwtPayload) {
    assertFieldSession(actor);
    return this.drones.adminListMissions("Active", actor);
  }

  async getMission(actor: JwtPayload, id: string) {
    assertFieldSession(actor);
    const mission = await this.drones.adminGetMission(id, actor);
    return {
      data: {
        ...mission.data,
        readOnly: true,
        controlsDisabled: true,
      },
    };
  }

  async requestDrone(actor: JwtPayload, body: { incidentId?: string; reason?: string }) {
    assertFieldSession(actor);
    return {
      data: {
        requested: true,
        incidentId: body.incidentId ?? null,
        reason: body.reason ?? "Field officer requested drone support",
        message: "Drone request recorded. Dispatch will coordinate mission assignment.",
        readOnly: true,
      },
    };
  }
}
