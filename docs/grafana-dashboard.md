# Grafana dashboard setup

THE EYE exposes Prometheus metrics at `GET /metrics` (outside the `/v1` API prefix).

## Prerequisites

- Prometheus 2.x scraping the API service
- Grafana 10+ with a Prometheus data source
- THE EYE API running with Redis enabled (queue depth metrics require BullMQ)

## Prometheus scrape configuration

Add a job that scrapes each API instance every 15–30 seconds:

```yaml
scrape_configs:
  - job_name: the-eye-api
    metrics_path: /metrics
    scrape_interval: 15s
    static_configs:
      - targets:
          - api:4000
```

### Docker Compose

If the API runs in the `the-eye` compose stack, point Prometheus at `the-eye-api:4000` on the internal network. Do not expose `/metrics` publicly without network restrictions.

### Kubernetes

Use a `PodMonitor` or `ServiceMonitor` (Prometheus Operator) targeting port `4000` and path `/metrics`. Restrict scrape access to the observability namespace.

## Exported metrics

| Metric | Type | Labels | Purpose |
|--------|------|--------|---------|
| `the_eye_http_request_duration_seconds` | Histogram | `method`, `route` | API latency |
| `the_eye_http_requests_total` | Counter | `method`, `route`, `status_class` | Request volume |
| `the_eye_http_errors_total` | Counter | `method`, `route`, `status_code` | Error rate (4xx/5xx) |
| `the_eye_db_query_duration_seconds` | Histogram | `model`, `operation` | DB latency |
| `the_eye_db_queries_total` | Counter | `model`, `operation`, `outcome` | DB query volume |
| `the_eye_bullmq_queue_depth` | Gauge | `queue`, `state` | Queue depth (`waiting`, `active`, `delayed`, `failed`, `completed`) |
| `the_eye_bullmq_jobs_total` | Counter | `queue`, `status` | Job outcomes (`completed`, `failed`, `retried`) |
| `the_eye_incident_submission_duration_seconds` | Histogram | `type`, `intake`, `outcome` | Incident submission timing |
| `the_eye_incident_submissions_total` | Counter | `type`, `intake`, `outcome` | Submission outcomes |
| `the_eye_notification_delivery_duration_seconds` | Histogram | `channel`, `outcome` | Notification delivery timing |
| `the_eye_notification_deliveries_total` | Counter | `channel`, `outcome` | Delivery outcomes |
| `the_eye_dependency_up` | Gauge | `dependency` | Postgres/Redis health (`1` = up) |
| `the_eye_process_*` | Default | — | Node.js process metrics (CPU, memory, event loop) |

Route labels normalize UUIDs and numeric IDs to `:id` to limit cardinality.

## Recommended Grafana panels

### 1. API latency (p50 / p95 / p99)

```promql
histogram_quantile(0.95, sum by (le, route) (rate(the_eye_http_request_duration_seconds_bucket[5m])))
```

Panel type: Time series. Unit: seconds.

### 2. API error rate

```promql
sum(rate(the_eye_http_errors_total[5m]))
/
sum(rate(the_eye_http_requests_total[5m]))
```

Panel type: Stat or time series. Unit: percent (0–1). Alert threshold: > 2% for 5 minutes.

### 3. Request volume by route

```promql
sum by (route) (rate(the_eye_http_requests_total[5m]))
```

Panel type: Bar chart or time series.

### 4. Database latency (p95)

```promql
histogram_quantile(0.95, sum by (le, model, operation) (rate(the_eye_db_query_duration_seconds_bucket[5m])))
```

Panel type: Time series. Unit: seconds. Alert threshold: p95 > 500ms for 10 minutes.

### 5. BullMQ queue depth

```promql
sum by (state) (the_eye_bullmq_queue_depth{queue="notifications"})
```

Panel type: Time series (stacked). Alert on `waiting` > 100 for 10 minutes.

### 6. Notification delivery latency (p95)

```promql
histogram_quantile(0.95, sum by (le, channel) (rate(the_eye_notification_delivery_duration_seconds_bucket[5m])))
```

Panel type: Time series. Unit: seconds.

### 7. Incident submission timing (emergency fast path)

```promql
histogram_quantile(0.95, sum by (le) (
  rate(the_eye_incident_submission_duration_seconds_bucket{intake="emergency_fast_path", outcome="success"}[5m])
))
```

Panel type: Time series. Target SLO: p95 < 3s.

### 8. Dependency health

```promql
the_eye_dependency_up
```

Panel type: Stat. Value mappings: `0` = down, `1` = up.

## Sample alert rules

```yaml
groups:
  - name: the-eye-api
    rules:
      - alert: TheEyeHighErrorRate
        expr: |
          sum(rate(the_eye_http_errors_total[5m]))
          /
          sum(rate(the_eye_http_requests_total[5m])) > 0.02
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: THE EYE API error rate above 2%

      - alert: TheEyeNotificationQueueBacklog
        expr: the_eye_bullmq_queue_depth{queue="notifications", state="waiting"} > 100
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: Notification queue backlog is growing

      - alert: TheEyePostgresDown
        expr: the_eye_dependency_up{dependency="postgres"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: Postgres dependency check failing

      - alert: TheEyeEmergencySubmissionSlow
        expr: |
          histogram_quantile(0.95, sum by (le) (
            rate(the_eye_incident_submission_duration_seconds_bucket{intake="emergency_fast_path"}[5m])
          )) > 3
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: Emergency incident submissions exceeding 3s p95
```

## Dashboard layout (suggested rows)

1. **Overview** — error rate, request rate, dependency health, process memory
2. **API** — latency heatmap, top routes by volume, 4xx/5xx breakdown
3. **Database** — query latency by model, slow-query rate, error count
4. **Notifications** — queue depth, delivery latency by channel, failed/retried jobs
5. **Incidents** — submission latency by type/intake, success vs error count

## Local verification

```bash
curl -s http://localhost:4000/metrics | head
```

You should see `the_eye_http_requests_total`, `the_eye_process_cpu_user_seconds_total`, and other series after traffic hits the API.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `THE_EYE_DISABLE_METRICS_POLLING` | unset | Set to `1` to disable background queue/dependency gauge refresh (useful in unit tests) |
| `THE_EYE_DISABLE_REDIS` | unset | When `1`, queue depth metrics report zero and BullMQ metrics are inactive |

## Security notes

- Treat `/metrics` as an internal admin endpoint.
- Place it behind VPC rules, Kubernetes network policies, or an authenticated reverse-proxy if exposed beyond the cluster.
- Metrics may include route templates but never include PII, tokens, or request bodies.
