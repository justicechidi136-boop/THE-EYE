export const PLACEHOLDER_DEPENDENCIES = {
  jurisdictions: {
    title: "Jurisdiction API",
    endpoint: "GET /v1/jurisdictions",
    note: "Jurisdiction tree and admin assignments require a jurisdictions listing endpoint.",
  },
  jobVacancies: {
    title: "Job vacancies API",
    endpoint: "GET /v1/job-vacancies",
    note: "Recruitment listings require a vacancies module and admin CRUD endpoints.",
  },
  liveChats: {
    title: "Live chat API",
    endpoint: "GET /v1/support/chats",
    note: "Citizen support threads require a realtime chat or ticketing backend.",
  },
  droneSurveillance: {
    title: "Drone surveillance API",
    endpoint: "GET /v1/drone-surveillance/admin/dashboard",
    note: "Fleet telemetry, missions, geofences, and incident-linked aerial evidence.",
  },
  agencies: {
    title: "Agency registry API",
    endpoint: "GET /v1/agencies",
    note: "Agency registry is served by GET /v1/agencies and admin mutations under /v1/admin/agencies.",
  },
  witnessConfirmations: {
    title: "Witness confirmation listing",
    endpoint: "GET /v1/verification/incidents/:id/confirmations",
    note: "Crowd confirmation requests use POST /v1/verification/incidents/:id/crowd-request with BullMQ enqueue (delivery BLOCKED without Redis/FCM).",
  },
  dashboardUserTrends: {
    title: "User registration analytics",
    endpoint: "GET /v1/analytics/users",
    note: "Monthly user registration trends require an analytics endpoint. User totals use the live directory count.",
  },
  liveVideoPlayer: {
    title: "LiveKit admin viewer",
    endpoint: "POST /v1/live-video/sessions/:sessionId/admin-token",
    note: "Stream playback requires a LiveKit admin token and client SDK integration.",
  },
} as const;
