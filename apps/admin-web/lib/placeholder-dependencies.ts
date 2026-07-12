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
  sailingPermit: {
    title: "Sailing permit API",
    endpoint: "GET /v1/sailing-permits",
    note: "Maritime permit applications require a dedicated permits module.",
  },
  agencies: {
    title: "Agency registry API",
    endpoint: "GET /v1/agencies",
    note: "Full agency registry data requires an agencies module. Active incident counts below are derived from assigned incidents.",
  },
  witnessConfirmations: {
    title: "Witness confirmation listing",
    endpoint: "GET /v1/verification/incidents/:id/confirmations",
    note: "Crowd confirmation requests can be sent via POST /v1/verification/incidents/:id/crowd-request, but witness status listing is not yet exposed.",
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
