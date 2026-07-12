import { Registry } from "prom-client";
import { normalizeRoute, statusClass } from "../route-normalizer";

describe("route normalizer", () => {
  it("replaces UUID path segments", () => {
    expect(normalizeRoute("/v1/incidents/550e8400-e29b-41d4-a716-446655440000")).toBe("/incidents/:id");
  });

  it("replaces numeric path segments", () => {
    expect(normalizeRoute("/v1/users/42/profile")).toBe("/users/:id/profile");
  });

  it("classifies status codes", () => {
    expect(statusClass(200)).toBe("2xx");
    expect(statusClass(404)).toBe("4xx");
    expect(statusClass(500)).toBe("5xx");
  });
});

describe("metrics service", () => {
  it("records HTTP, DB, queue, incident, and notification metrics", async () => {
    const { MetricsService } = await import("../metrics.service");
    const registry = new Registry();
    const metrics = new MetricsService(registry);

    metrics.recordHttpRequest("GET", "/v1/incidents/abc", 200, 0.12);
    metrics.recordHttpRequest("POST", "/v1/incidents", 500, 1.5);
    metrics.recordDbQuery("Incident", "findMany", 0.03, "success");
    metrics.setQueueDepth("notifications", "waiting", 4);
    metrics.recordQueueJob("notifications", "completed");
    metrics.recordIncidentSubmission("Emergency", "emergency_fast_path", 0.8, "success");
    metrics.recordNotificationDelivery("push", 0.4, "success");
    metrics.recordVerification("system_ai_initial", 1.2, "success");
    metrics.recordBroadcastDispatch(2.5, "success");
    metrics.recordLiveVideoOperation("location_update", 0.05, "success");
    metrics.recordRedisOperation("bullmq_enqueue", 0.01, "success");
    metrics.setDependencyUp("postgres", true);

    const rendered = await metrics.renderMetrics();
    expect(rendered).toContain("the_eye_http_request_duration_seconds");
    expect(rendered).toContain("the_eye_http_errors_total");
    expect(rendered).toContain("the_eye_db_query_duration_seconds");
    expect(rendered).toContain("the_eye_bullmq_queue_depth");
    expect(rendered).toContain("the_eye_incident_submission_duration_seconds");
    expect(rendered).toContain("the_eye_notification_delivery_duration_seconds");
    expect(rendered).toContain("the_eye_verification_duration_seconds");
    expect(rendered).toContain("the_eye_broadcast_dispatch_duration_seconds");
    expect(rendered).toContain("the_eye_live_video_operation_duration_seconds");
    expect(rendered).toContain("the_eye_redis_operation_duration_seconds");
    expect(rendered).toContain("the_eye_dependency_up");
  });
});
