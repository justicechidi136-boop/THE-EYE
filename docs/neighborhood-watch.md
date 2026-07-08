# THE EYE Neighborhood Watch

Neighborhood Watch is integrated as a community safety platform connected to users, incidents, broadcasts, notifications, roles, PostGIS, and the admin dashboard.

## Structure

Communities support the hierarchy:

Country -> State -> LGA -> Ward -> Community -> Estate -> Street

Each community can be public or private, has optional PostGIS `boundary` and `center`, and can inherit jurisdiction context.

## Membership And Roles

Users can join public communities immediately or request access to private communities. Moderators approve pending access.

Community roles:

- Community Moderator
- Estate Admin
- Security Coordinator
- Police Liaison
- Volunteer Coordinator
- Verified Volunteer
- Resident

## Feed And Verification

Community posts support safety-specific types such as suspicious activity, lost child, missing person, crime alert, accident alert, fire alert, flood warning, announcements, meetings, and patrol updates.

Verification status:

- Pending Verification
- Verified
- Disputed
- False Information

Confidence scoring combines reporter trust, location match, media evidence, confirmations, moderator confirmation, and related incident links.

## Incident And Broadcast Links

Moderators/admins can link posts to incidents, convert posts into incidents, and share verified posts to Neighborhood, LGA, State, or Emergency broadcasts.

## Notifications And Map

Approved community members receive location/community-targeted notifications. Map data combines community posts, incidents, police stations, volunteer points, patrols, safe points, hospitals, and danger zones.

## Chat And Patrols

Channels include General, Emergency, Security, Volunteers, Women Safety, Parents, and Business Owners. The API returns websocket-ready room names for realtime adapters.

Patrols support schedules, volunteer assignment, checkpoint logs, and patrol reports.

## Security

Private community content requires approved membership. Moderator actions are scoped to assigned communities and written to `audit_logs`.
