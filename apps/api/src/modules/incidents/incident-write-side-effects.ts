import { Logger } from "@nestjs/common";

const logger = new Logger("IncidentWriteSideEffects");

export type NonCriticalWriteContext = {
  incidentId: string;
  intake: "emergency_fast_path" | "standard";
  clientSubmissionId?: string;
};

export type NonCriticalWriteResult = {
  warnings: string[];
};

export async function runNonCriticalWrite(
  operation: string,
  context: NonCriticalWriteContext,
  task: () => Promise<void>,
  warnings: string[],
): Promise<void> {
  try {
    await task();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const warning = `${operation}: ${message}`;
    warnings.push(warning);
    logger.warn(
      JSON.stringify({
        event: "incident.non_critical_write_failed",
        operation,
        incidentId: context.incidentId,
        intake: context.intake,
        clientSubmissionId: context.clientSubmissionId ?? null,
        message,
      }),
    );
  }
}

export function emptyOptionalString(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
