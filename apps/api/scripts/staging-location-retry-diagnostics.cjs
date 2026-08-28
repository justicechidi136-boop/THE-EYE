const { createHash } = require("node:crypto");
const { Queue } = require("bullmq");
const { PrismaClient } = require("@prisma/client");

const TERMINAL_STATUSES = new Set(["Resolved", "Closed", "FalseReport"]);

function sanitizeIdentifier(value) {
  return `job-${createHash("sha256").update(String(value ?? "unknown")).digest("hex").slice(0, 10)}`;
}

function sanitizeReason(value) {
  return String(value || "Unknown failure")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, "[record]")
    .replace(/-?\d{1,3}\.\d{4,}/g, "[coordinate]")
    .replace(/(token|password|secret|key)=\S+/gi, "$1=[redacted]")
    .slice(0, 300);
}

function classifyFailure(reason, incident, persisted) {
  if (persisted) return { classification: "stale_completed", workStillNeeded: false };
  if (!incident) return { classification: "stale_missing_record", workStillNeeded: false };
  if (TERMINAL_STATUSES.has(String(incident.status))) {
    return { classification: "stale_terminal_record", workStillNeeded: false };
  }
  const normalized = String(reason || "").toLowerCase();
  if (/not found|closed incident|out-of-order|invalid|timestamp|coordinate/.test(normalized)) {
    return { classification: "deterministic", workStillNeeded: false };
  }
  return { classification: "transient_or_unclassified", workStillNeeded: true };
}

async function inspect() {
  if (process.env.THE_EYE_APP_ENV !== "staging") throw new Error("Diagnostics are staging-only");
  const connection = {
    host: process.env.REDIS_HOST || "redis",
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD,
    db: Number(process.env.REDIS_DB || 0),
    maxRetriesPerRequest: null,
  };
  const queueName = "the-eye-staging-incident-location-retry";
  const queue = new Queue(queueName, { connection });
  const prisma = new PrismaClient();
  try {
    const jobs = await queue.getJobs(["failed"], 0, 49, true);
    const diagnostics = [];
    for (const job of jobs) {
      const incidentId = job.data?.incidentId;
      const sequenceNumber = job.data?.dto?.sequenceNumber;
      const idempotencyKey = job.data?.idempotencyKey;
      const incident = incidentId
        ? await prisma.incident.findUnique({ where: { id: incidentId }, select: { status: true } })
        : null;
      const persisted = incidentId
        ? await prisma.incidentLocationUpdate.findFirst({
            where: {
              incidentId,
              OR: [
                ...(Number.isInteger(sequenceNumber) ? [{ sequenceNumber }] : []),
                ...(idempotencyKey ? [{ metadata: { path: ["idempotencyKey"], equals: idempotencyKey } }] : []),
              ],
            },
            select: { id: true },
          })
        : null;
      const assessment = classifyFailure(job.failedReason, incident, Boolean(persisted));
      diagnostics.push({
        queue: queueName,
        jobName: job.name,
        jobId: sanitizeIdentifier(job.id),
        failureReason: sanitizeReason(job.failedReason),
        attemptsMade: job.attemptsMade,
        attemptsConfigured: job.opts?.attempts ?? 1,
        firstFailureAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
        lastFailureAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
        associatedRecordType: "incident",
        recordExists: Boolean(incident),
        recordStatus: incident?.status ?? "missing",
        persistedEquivalentExists: Boolean(persisted),
        ...assessment,
      });
    }
    console.log(JSON.stringify({ queue: queueName, failedCount: diagnostics.length, jobs: diagnostics }, null, 2));
  } finally {
    await Promise.allSettled([queue.close(), prisma.$disconnect()]);
  }
}

if (process.argv.includes("--self-test")) {
  const safe = sanitizeReason("Incident 11111111-1111-4111-8111-111111111111 at 6.524379 token=private");
  if (safe.includes("11111111") || safe.includes("6.524379") || safe.includes("private")) process.exit(1);
  console.log("PASS staging location retry diagnostics sanitizer");
} else {
  inspect().catch((error) => {
    console.error(`Location retry diagnostics failed: ${sanitizeReason(error?.message)}`);
    process.exit(1);
  });
}
