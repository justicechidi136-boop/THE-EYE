import { Injectable } from "@nestjs/common";
import type { JwtPayload } from "../../common/auth/jwt";
import type { FieldSyncBatchDto } from "./dto/field-workflows.dto";
import { FieldBoloService } from "./field-bolo.service";
import { FieldCheckpointsService } from "./field-checkpoints.service";
import { FieldOperationalResponsesService } from "./field-operational-responses.service";
import { FieldPatrolsService } from "./field-patrols.service";
import { FieldShiftsService } from "./field-shifts.service";

@Injectable()
export class FieldSyncService {
  constructor(
    private readonly shifts: FieldShiftsService,
    private readonly patrols: FieldPatrolsService,
    private readonly checkpoints: FieldCheckpointsService,
    private readonly responses: FieldOperationalResponsesService,
    private readonly bolo: FieldBoloService,
  ) {}

  async syncBatch(actor: JwtPayload, dto: FieldSyncBatchDto) {
    const results: Array<{ clientActionId: string; ok: boolean; type: string; error?: string }> = [];

    for (const item of dto.items ?? []) {
      try {
        switch (item.type) {
          case "shift":
            if ((item.payload.action as string) === "end") {
              await this.shifts.endShift(actor, item.payload as never);
            } else {
              await this.shifts.startShift(actor, { ...item.payload, clientActionId: item.clientActionId } as never);
            }
            break;
          case "patrol":
            if ((item.payload.action as string) === "location") {
              await this.patrols.recordLocation(actor, { ...item.payload, clientActionId: item.clientActionId } as never);
            } else if ((item.payload.action as string) === "end") {
              await this.patrols.endPatrol(actor);
            } else {
              await this.patrols.startPatrol(actor, { ...item.payload, clientActionId: item.clientActionId } as never);
            }
            break;
          case "checkpoint":
            if ((item.payload.action as string) === "end") {
              await this.checkpoints.endCheckpoint(actor);
            } else {
              await this.checkpoints.startCheckpoint(actor, { ...item.payload, clientActionId: item.clientActionId } as never);
            }
            break;
          case "response":
            await this.responses.recordResponse(actor, { ...item.payload, clientActionId: item.clientActionId } as never);
            break;
          case "sighting":
            await this.bolo.createSighting(actor, { ...item.payload, clientActionId: item.clientActionId } as never);
            break;
          case "patrolLocation":
            await this.patrols.recordLocation(actor, { ...item.payload, clientActionId: item.clientActionId } as never);
            break;
          default:
            throw new Error(`Unsupported sync item type: ${item.type}`);
        }
        results.push({ clientActionId: item.clientActionId, ok: true, type: item.type });
      } catch (error) {
        results.push({
          clientActionId: item.clientActionId,
          ok: false,
          type: item.type,
          error: error instanceof Error ? error.message : "Sync failed",
        });
      }
    }

    return { data: { results } };
  }
}
