import { Injectable } from "@nestjs/common";
import type { JwtPayload } from "../../common/auth/jwt";
import { DispatchService } from "../dispatch/dispatch.service";
import { IncidentTimelineService } from "../dispatch/incident-timeline.service";
import { LocationTrackingService } from "../dispatch/location-tracking.service";
import type { AssignmentLocationDto, UpdateDispatchAssignmentDto } from "../dispatch/dto/dispatch.dto";
import { assertFieldSession } from "./field-session.util";

@Injectable()
export class FieldAssignmentsService {
  constructor(
    private readonly dispatch: DispatchService,
    private readonly locationTracking: LocationTrackingService,
    private readonly timeline: IncidentTimelineService,
  ) {}

  async listMine(actor: JwtPayload, query: { status?: string; limit?: string } = {}) {
    assertFieldSession(actor);
    return this.dispatch.getMyAssignments(actor, query);
  }

  async getAssignment(actor: JwtPayload, id: string) {
    assertFieldSession(actor);
    return this.dispatch.getAssignment(id, actor);
  }

  async updateAssignment(actor: JwtPayload, id: string, dto: UpdateDispatchAssignmentDto) {
    assertFieldSession(actor);
    return this.dispatch.updateAssignment(id, dto, actor);
  }

  async recordLocation(actor: JwtPayload, id: string, dto: AssignmentLocationDto) {
    assertFieldSession(actor);
    return this.locationTracking.recordResponderLocation(id, dto, actor);
  }

  async liveLocation(actor: JwtPayload, id: string) {
    assertFieldSession(actor);
    return this.locationTracking.getResponderLiveLocation(id, actor);
  }

  async requestBackup(actor: JwtPayload, id: string, reason: string) {
    assertFieldSession(actor);
    return this.dispatch.requestAssignmentBackup(id, reason, actor);
  }

  async getIncidentTimeline(actor: JwtPayload, assignmentId: string) {
    assertFieldSession(actor);
    const assignment = await this.dispatch.getAssignment(assignmentId, actor);
    const incidentId = assignment.data?.incidentId ?? assignment.data?.incident?.id;
    if (!incidentId) throw new Error("Assignment incident not found");
    return this.timeline.buildTimeline(incidentId, "responder", actor);
  }
}
