# Neighborhood Watch — Product Flow

## Traveler (public)

1. Open Neighborhood Watch  
2. Capture GPS (freshness + accuracy)  
3. Call context API  
4. Enter public community as location participant  
5. View safety summary, alerts, feed, broadcasts (referenced)  
6. Post tip / discussion / hazard / suspicious activity  
7. Comment (text/voice)  
8. Travel → stable new GPS → area-changed banner → new public context  

## Private estate

1. Enter private geofence → private content still hidden  
2. Request membership  
3. Community admin approve/reject  
4. On approve → private feed/alerts/patrols  
5. Remove/suspend → access revoked  

## Suspicious activity → verification → escalation

1. Community post (Suspicious Activity / hazard)  
2. Eligible nearby users may receive incident-style verification when policy issues a request  
3. Serious risk → escalate via `convert-to-incident` → canonical Incident  
4. Linkage: source community/post, escalatedBy/At, resultingIncidentId  

## Emergency

Immediate danger → **Report Emergency** (canonical journey). NW never silently auto-creates emergencies from keywords.
