import { Inject, Injectable, Optional } from "@nestjs/common";
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from "prom-client";
import { PROMETHEUS_REGISTRY } from "./prometheus-registry.token";
import { normalizeRoute, statusClass } from "./route-normalizer";

const HTTP_DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const DB_DURATION_BUCKETS = [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5];
const INCIDENT_DURATION_BUCKETS = [0.05, 0.1, 0.25, 0.5, 1, 2, 3, 5, 10, 30];
const NOTIFICATION_DURATION_BUCKETS = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60];
const VERIFICATION_DURATION_BUCKETS = [0.05, 0.1, 0.25, 0.5, 1, 2, 3, 5, 10, 30];
const BROADCAST_DURATION_BUCKETS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60, 120];
const LIVE_VIDEO_DURATION_BUCKETS = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5];
const REDIS_DURATION_BUCKETS = [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1];

@Injectable()
export class MetricsService {
  private readonly registry: Registry;
  private readonly httpRequestDuration: Histogram<"method" | "route">;
  private readonly httpRequestsTotal: Counter<"method" | "route" | "status_class">;
  private readonly httpErrorsTotal: Counter<"method" | "route" | "status_code">;
  private readonly dbQueryDuration: Histogram<"model" | "operation">;
  private readonly dbQueriesTotal: Counter<"model" | "operation" | "outcome">;
  private readonly queueDepth: Gauge<"queue" | "state">;
  private readonly queueJobsTotal: Counter<"queue" | "status">;
  private readonly incidentSubmissionDuration: Histogram<"type" | "intake" | "outcome">;
  private readonly incidentSubmissionsTotal: Counter<"type" | "intake" | "outcome">;
  private readonly notificationDeliveryDuration: Histogram<"channel" | "outcome">;
  private readonly notificationDeliveriesTotal: Counter<"channel" | "outcome">;
  private readonly verificationDuration: Histogram<"method" | "outcome">;
  private readonly verificationsTotal: Counter<"method" | "outcome">;
  private readonly broadcastDispatchDuration: Histogram<"outcome">;
  private readonly broadcastDispatchesTotal: Counter<"outcome">;
  private readonly liveVideoOperationDuration: Histogram<"operation" | "outcome">;
  private readonly liveVideoOperationsTotal: Counter<"operation" | "outcome">;
  private readonly redisOperationDuration: Histogram<"operation" | "outcome">;
  private readonly redisOperationsTotal: Counter<"operation" | "outcome">;
  private readonly dependencyUp: Gauge<"dependency">;

  constructor(@Optional() @Inject(PROMETHEUS_REGISTRY) registry?: Registry) {
    this.registry = registry ?? new Registry();

    this.httpRequestDuration = new Histogram({
      name: "the_eye_http_request_duration_seconds",
      help: "HTTP request latency in seconds",
      labelNames: ["method", "route"],
      buckets: HTTP_DURATION_BUCKETS,
      registers: [this.registry],
    });

    this.httpRequestsTotal = new Counter({
      name: "the_eye_http_requests_total",
      help: "Total HTTP requests",
      labelNames: ["method", "route", "status_class"],
      registers: [this.registry],
    });

    this.httpErrorsTotal = new Counter({
      name: "the_eye_http_errors_total",
      help: "Total HTTP error responses (4xx and 5xx)",
      labelNames: ["method", "route", "status_code"],
      registers: [this.registry],
    });

    this.dbQueryDuration = new Histogram({
      name: "the_eye_db_query_duration_seconds",
      help: "Database query latency in seconds",
      labelNames: ["model", "operation"],
      buckets: DB_DURATION_BUCKETS,
      registers: [this.registry],
    });

    this.dbQueriesTotal = new Counter({
      name: "the_eye_db_queries_total",
      help: "Total database queries",
      labelNames: ["model", "operation", "outcome"],
      registers: [this.registry],
    });

    this.queueDepth = new Gauge({
      name: "the_eye_bullmq_queue_depth",
      help: "BullMQ queue depth by state",
      labelNames: ["queue", "state"],
      registers: [this.registry],
    });

    this.queueJobsTotal = new Counter({
      name: "the_eye_bullmq_jobs_total",
      help: "BullMQ job outcomes",
      labelNames: ["queue", "status"],
      registers: [this.registry],
    });

    this.incidentSubmissionDuration = new Histogram({
      name: "the_eye_incident_submission_duration_seconds",
      help: "Incident submission latency in seconds",
      labelNames: ["type", "intake", "outcome"],
      buckets: INCIDENT_DURATION_BUCKETS,
      registers: [this.registry],
    });

    this.incidentSubmissionsTotal = new Counter({
      name: "the_eye_incident_submissions_total",
      help: "Incident submission outcomes",
      labelNames: ["type", "intake", "outcome"],
      registers: [this.registry],
    });

    this.notificationDeliveryDuration = new Histogram({
      name: "the_eye_notification_delivery_duration_seconds",
      help: "Notification delivery latency in seconds",
      labelNames: ["channel", "outcome"],
      buckets: NOTIFICATION_DURATION_BUCKETS,
      registers: [this.registry],
    });

    this.notificationDeliveriesTotal = new Counter({
      name: "the_eye_notification_deliveries_total",
      help: "Notification delivery outcomes",
      labelNames: ["channel", "outcome"],
      registers: [this.registry],
    });

    this.verificationDuration = new Histogram({
      name: "the_eye_verification_duration_seconds",
      help: "Incident verification latency in seconds",
      labelNames: ["method", "outcome"],
      buckets: VERIFICATION_DURATION_BUCKETS,
      registers: [this.registry],
    });

    this.verificationsTotal = new Counter({
      name: "the_eye_verifications_total",
      help: "Incident verification outcomes",
      labelNames: ["method", "outcome"],
      registers: [this.registry],
    });

    this.broadcastDispatchDuration = new Histogram({
      name: "the_eye_broadcast_dispatch_duration_seconds",
      help: "Broadcast dispatch latency in seconds",
      labelNames: ["outcome"],
      buckets: BROADCAST_DURATION_BUCKETS,
      registers: [this.registry],
    });

    this.broadcastDispatchesTotal = new Counter({
      name: "the_eye_broadcast_dispatches_total",
      help: "Broadcast dispatch outcomes",
      labelNames: ["outcome"],
      registers: [this.registry],
    });

    this.liveVideoOperationDuration = new Histogram({
      name: "the_eye_live_video_operation_duration_seconds",
      help: "Live video operation latency in seconds",
      labelNames: ["operation", "outcome"],
      buckets: LIVE_VIDEO_DURATION_BUCKETS,
      registers: [this.registry],
    });

    this.liveVideoOperationsTotal = new Counter({
      name: "the_eye_live_video_operations_total",
      help: "Live video operation outcomes",
      labelNames: ["operation", "outcome"],
      registers: [this.registry],
    });

    this.redisOperationDuration = new Histogram({
      name: "the_eye_redis_operation_duration_seconds",
      help: "Redis operation latency in seconds",
      labelNames: ["operation", "outcome"],
      buckets: REDIS_DURATION_BUCKETS,
      registers: [this.registry],
    });

    this.redisOperationsTotal = new Counter({
      name: "the_eye_redis_operations_total",
      help: "Redis operation outcomes",
      labelNames: ["operation", "outcome"],
      registers: [this.registry],
    });

    this.dependencyUp = new Gauge({
      name: "the_eye_dependency_up",
      help: "Dependency health (1 = up, 0 = down or skipped)",
      labelNames: ["dependency"],
      registers: [this.registry],
    });

    collectDefaultMetrics({ register: this.registry, prefix: "the_eye_" });
  }

  recordHttpRequest(method: string, path: string, statusCode: number, durationSeconds: number) {
    const route = normalizeRoute(path);
    this.httpRequestDuration.labels(method, route).observe(durationSeconds);
    this.httpRequestsTotal.labels(method, route, statusClass(statusCode)).inc();
    if (statusCode >= 400) {
      this.httpErrorsTotal.labels(method, route, String(statusCode)).inc();
    }
  }

  recordDbQuery(model: string, operation: string, durationSeconds: number, outcome: "success" | "error" = "success") {
    this.dbQueryDuration.labels(model, operation).observe(durationSeconds);
    this.dbQueriesTotal.labels(model, operation, outcome).inc();
  }

  setQueueDepth(queue: string, state: string, count: number) {
    this.queueDepth.labels(queue, state).set(count);
  }

  recordQueueJob(queue: string, status: "completed" | "failed" | "retried") {
    this.queueJobsTotal.labels(queue, status).inc();
  }

  recordIncidentSubmission(type: string, intake: string, durationSeconds: number, outcome: "success" | "error") {
    this.incidentSubmissionDuration.labels(type, intake, outcome).observe(durationSeconds);
    this.incidentSubmissionsTotal.labels(type, intake, outcome).inc();
  }

  recordNotificationDelivery(channel: string, durationSeconds: number, outcome: "success" | "failed" | "retry") {
    this.notificationDeliveryDuration.labels(channel, outcome).observe(durationSeconds);
    this.notificationDeliveriesTotal.labels(channel, outcome).inc();
  }

  recordVerification(method: string, durationSeconds: number, outcome: "success" | "error") {
    this.verificationDuration.labels(method, outcome).observe(durationSeconds);
    this.verificationsTotal.labels(method, outcome).inc();
  }

  recordBroadcastDispatch(durationSeconds: number, outcome: "success" | "error") {
    this.broadcastDispatchDuration.labels(outcome).observe(durationSeconds);
    this.broadcastDispatchesTotal.labels(outcome).inc();
  }

  recordLiveVideoOperation(operation: string, durationSeconds: number, outcome: "success" | "error") {
    this.liveVideoOperationDuration.labels(operation, outcome).observe(durationSeconds);
    this.liveVideoOperationsTotal.labels(operation, outcome).inc();
  }

  recordRedisOperation(operation: string, durationSeconds: number, outcome: "success" | "error") {
    this.redisOperationDuration.labels(operation, outcome).observe(durationSeconds);
    this.redisOperationsTotal.labels(operation, outcome).inc();
  }

  setDependencyUp(dependency: string, up: boolean) {
    this.dependencyUp.labels(dependency).set(up ? 1 : 0);
  }

  async renderMetrics() {
    return this.registry.metrics();
  }

  get contentType() {
    return this.registry.contentType;
  }
}
