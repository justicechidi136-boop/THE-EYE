export const INFORMATION_REQUEST_TYPES = [
  "injured_count",
  "fire_still_active",
  "suspect_still_present",
  "vehicle_description",
  "direction_of_travel",
  "safe_to_call",
  "exact_landmark",
  "medical_assistance_required",
  "road_blocked",
  "situation_still_ongoing",
  "custom_approved",
] as const;

export type InformationRequestType = (typeof INFORMATION_REQUEST_TYPES)[number];

export const QUICK_REPLY_ACTIONS = [
  "yes",
  "no",
  "unsure",
  "still_ongoing",
  "situation_resolved",
  "unsafe_to_respond",
  "send_voice_response",
  "send_photo",
  "share_current_location",
] as const;

export function informationRequestPrompt(type: InformationRequestType, custom?: string) {
  const prompts: Record<InformationRequestType, string> = {
    injured_count: "How many people are injured?",
    fire_still_active: "Is the fire still active?",
    suspect_still_present: "Is the suspect still present?",
    vehicle_description: "Please describe the vehicle involved.",
    direction_of_travel: "Which direction did they travel?",
    safe_to_call: "Is it safe for us to call you?",
    exact_landmark: "What is the nearest exact landmark?",
    medical_assistance_required: "Is medical assistance required?",
    road_blocked: "Is the road blocked?",
    situation_still_ongoing: "Is the situation still ongoing?",
    custom_approved: custom?.trim() || "Please provide the requested information.",
  };
  return prompts[type];
}

export function defaultAllowedReplyTypes(type: InformationRequestType) {
  if (type === "injured_count" || type === "vehicle_description" || type === "exact_landmark") {
    return ["text", "voice", "photo"];
  }
  return ["quick_reply", "text", "voice", "photo", "location"];
}
