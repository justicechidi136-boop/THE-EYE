# Neighborhood Watch — Notification Contract

Extend Notification Schema v1. Do not invent unscoped deep links.

| Event | routeType / type | Destination pattern |
|-------|------------------|---------------------|
| Community alert | `NW_COMMUNITY_ALERT` | `/neighborhood-watch/alerts` or alert detail |
| Post activity | `NW_POST_ACTIVITY` | `/neighborhood-watch/post/:id` |
| New discussion | `NW_NEW_DISCUSSION` | `/neighborhood-watch/post/:id` |
| Verification | `NW_VERIFICATION_REQUEST` | `/community-verification/:requestId` or NW verification route |
| Comment | `NW_POST_COMMENT` | `/neighborhood-watch/post/:id` |
| Thread reply | `NW_POST_REPLY` | `/neighborhood-watch/post/:id` |
| Patrol invite/update | `NW_PATROL_*` | `/neighborhood-watch/patrol/:id` |
| Membership | `NW_MEMBERSHIP_*` | `/neighborhood-watch/private/:id/membership` |
| Area changed | `NW_AREA_CHANGED` | `/neighborhood-watch` |
| Escalation | `NW_ESCALATION_UPDATE` | post or incident detail when authorized |

Open always re-fetches authorization from the server. Private lock-screen bodies stay non-sensitive.

### Discussion fanout policy

- Prefer proximity / community relevance / followed threads / safety importance / user preferences.
- Do **not** notify every community user about every ordinary tip.
- `NW_NEW_DISCUSSION` is scoped and rate-limited via the existing community notify path.
- `NW_POST_COMMENT` targets the post author; `NW_POST_REPLY` targets prior commenters on the thread (excluding the new commenter).
