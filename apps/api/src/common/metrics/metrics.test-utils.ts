import { MetricsService } from "./metrics.service";

export function createMetricsMock() {
  return {
    recordHttpRequest: jest.fn(),
    recordDbQuery: jest.fn(),
    setQueueDepth: jest.fn(),
    recordQueueJob: jest.fn(),
    recordIncidentSubmission: jest.fn(),
    recordNotificationDelivery: jest.fn(),
    recordVerification: jest.fn(),
    recordBroadcastDispatch: jest.fn(),
    recordLiveVideoOperation: jest.fn(),
    recordRedisOperation: jest.fn(),
    setDependencyUp: jest.fn(),
    renderMetrics: jest.fn().mockResolvedValue(""),
    contentType: "text/plain; version=0.0.4; charset=utf-8",
  } as unknown as MetricsService;
}
