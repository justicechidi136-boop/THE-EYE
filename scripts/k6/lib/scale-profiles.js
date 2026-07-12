/**
 * Scale tiers for THE EYE 5M-user readiness testing.
 * SCALE env selects concurrent-user target (100 | 1000 | 10000 | 100000).
 */

export const SCALE_TIERS = [100, 1000, 10000, 100000];

export function resolveScale() {
  const raw = Number(__ENV.SCALE || 100);
  return SCALE_TIERS.includes(raw) ? raw : 100;
}

function rampingProfile(target, sustainMinutes) {
  const warm = Math.max(1, Math.floor(target * 0.2));
  return {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "1m", target: warm },
      { duration: `${sustainMinutes}m`, target },
      { duration: "30s", target: Math.floor(target * 0.5) },
      { duration: "30s", target: 0 },
    ],
    gracefulRampDown: "30s",
    exec: "platformMix",
  };
}

function arrivalProfile(scale, ratePerSecond, durationMinutes, maxVUs) {
  return {
    executor: "constant-arrival-rate",
    rate: ratePerSecond,
    timeUnit: "1s",
    duration: `${durationMinutes}m`,
    preAllocatedVUs: Math.min(maxVUs, 200),
    maxVUs,
    gracefulStop: "30s",
    exec: "platformMix",
  };
}

export function buildScaleOptions(scale) {
  const thresholds = {
    http_req_failed: ["rate<0.25"],
    api_latency: ["p(95)<3000"],
    verification_latency: ["p(95)<5000"],
    broadcast_latency: ["p(95)<8000"],
    notification_latency: ["p(95)<3000"],
    live_video_latency: ["p(95)<1500"],
    db_latency_proxy: ["p(95)<500"],
    redis_latency_proxy: ["p(95)<250"],
  };

  if (scale <= 100) {
    return {
      scenarios: { platform_mix: rampingProfile(100, 3) },
      thresholds,
    };
  }

  if (scale <= 1000) {
    return {
      scenarios: { platform_mix: rampingProfile(1000, 5) },
      thresholds,
    };
  }

  if (scale <= 10000) {
    return {
      scenarios: {
        platform_mix: arrivalProfile(scale, 400, 6, 800),
      },
      thresholds: {
        ...thresholds,
        http_req_failed: ["rate<0.30"],
        api_latency: ["p(95)<4000"],
      },
    };
  }

  return {
    scenarios: {
      platform_mix: arrivalProfile(scale, 2500, 8, 2500),
    },
    thresholds: {
      ...thresholds,
      http_req_failed: ["rate<0.35"],
      api_latency: ["p(95)<5000"],
    },
  };
}

export function scaleLabel(scale) {
  if (scale >= 100000) return "100k simulated active users";
  if (scale >= 10000) return "10k simulated active users";
  return `${scale} concurrent VUs`;
}
