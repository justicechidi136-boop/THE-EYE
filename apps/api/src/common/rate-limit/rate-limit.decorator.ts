import { SetMetadata } from "@nestjs/common";
import type { RateLimitPolicyName } from "./rate-limit.policy";

export const RATE_LIMIT_KEY = "the_eye_rate_limit_policy";

export const RateLimit = (policy: RateLimitPolicyName) => SetMetadata(RATE_LIMIT_KEY, policy);
