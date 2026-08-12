# Neighborhood Watch — Physical Device QA

**Status:** PHYSICAL QA PENDING — do not mark PASS without device evidence.

Capture APK SHA-256, device model, Android version, screenshots/recordings, request IDs, push evidence.

## Scenario A — Traveler

- [ ] Open NW in Public Community A (context resolves)
- [ ] View alerts/feed
- [ ] Create Safety Tip + comment
- [ ] Move/simulate Community B location → area switch banner
- [ ] Confirm Community A private data not retained

## Scenario B — Discussion

- [ ] User A discussion → User B sees/comments
- [ ] Voice comment
- [ ] Report abuse → moderator action

## Scenario B2 — Public user-initiated conversations (mandatory)

Two devices/accounts in the **same** staging public geofence with **zero** existing discussions:

**Device A**

- [ ] Enter public community with empty feed (“No community discussions yet” + Start Conversation)
- [ ] Tap **Start Conversation** → create a **Security Tip**
- [ ] Create a **voice-based Safety Discussion** (Record → Stop → Preview → Play → Post)
- [ ] Confirm author can be presence-only (traveler) without permanent membership

**Device B** (same geographic community)

- [ ] Open Neighborhood Watch → see both conversations
- [ ] Comment on one thread
- [ ] Add a voice comment

**Move / simulate Device A into another approved staging geofence**

- [ ] Public community context changes
- [ ] **Start Conversation** remains available in the new community
- [ ] New conversation is created in the **new** community only
- [ ] Prior community content is not incorrectly posted into the new community
- [ ] Immediate-danger **Report Emergency** still routes to canonical Emergency Reporting

## Scenario C — Suspicious Activity

- [ ] Report suspicious activity
- [ ] Nearby user verification (if issued)
- [ ] Escalate → canonical incident + linkage

## Scenario D — Private Estate

- [ ] Inside private geofence → still denied
- [ ] Request → approve → access
- [ ] Remove → access gone

## Scenario E — Patrol

- [ ] Schedule → join → start → observation → assistance → end

## Scenario F — Offline

- [ ] Cached feed shows stale label
- [ ] Queue safe action if supported
- [ ] Reconnect re-resolves context before sensitive replay
