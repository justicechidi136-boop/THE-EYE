import { fetchCommunities, fetchCommunityPosts, fetchIncidents, fetchPatrols, fetchPoliceStations, fetchSmartwatchDevices, fetchSosEvents, fetchVolunteers, fetchLiveVideoSessions } from "../api/data";

export type MapMarker = {
  id: string;
  type: string;
  label: string;
  lat: number;
  lng: number;
  status?: string;
  detail?: string;
};

export type CsocMapLayers = {
  incidents: MapMarker[];
  liveVideos: MapMarker[];
  volunteers: MapMarker[];
  patrols: MapMarker[];
  sos: MapMarker[];
  policeStations: MapMarker[];
  posts: MapMarker[];
  devices: MapMarker[];
};

function parseCoords(location: string): { lat: number; lng: number } | null {
  const [latRaw, lngRaw] = location.split(",").map((v) => v.trim());
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  return { lat, lng };
}

export async function fetchCsocMapLayers(): Promise<CsocMapLayers> {
  const [posts, volunteers, patrols, incidents, devices, sosEvents, liveSessions, policeStations] = await Promise.all([
    fetchCommunityPosts(),
    fetchVolunteers(),
    fetchPatrols(),
    fetchIncidents(),
    fetchSmartwatchDevices(),
    fetchSosEvents(),
    fetchLiveVideoSessions(),
    fetchPoliceStations(),
  ]);

  return {
    posts: posts
      .map((post): MapMarker | null => {
        const coords = parseCoords(post.location);
        if (!coords) return null;
        return { id: post.id, type: "post", label: post.title, lat: coords.lat, lng: coords.lng, status: post.status, detail: post.community };
      })
      .filter((m): m is MapMarker => m !== null),
    volunteers: volunteers
      .map((v, i): MapMarker | null => {
        if (v.latitude != null && v.longitude != null) {
          return {
            id: v.id ?? `vol-${i}`,
            type: "volunteer",
            label: v.name,
            lat: v.latitude,
            lng: v.longitude,
            status: v.status,
            detail: v.type,
          };
        }
        return null;
      })
      .filter((m): m is MapMarker => m !== null),
    patrols: patrols
      .map((p): MapMarker | null => {
        if (p.latitude != null && p.longitude != null) {
          return {
            id: p.id,
            type: "patrol",
            label: p.title,
            lat: p.latitude,
            lng: p.longitude,
            status: p.status,
            detail: p.community,
          };
        }
        return null;
      })
      .filter((m): m is MapMarker => m !== null),
    incidents: incidents
      .filter((i) => i.gps.lat && i.gps.lng)
      .map((i) => ({
        id: i.id,
        type: "incident",
        label: i.title,
        lat: i.gps.lat,
        lng: i.gps.lng,
        status: i.status,
        detail: i.type,
      })),
    liveVideos: liveSessions
      .filter((s) => s.latitude && s.longitude)
      .map((s) => ({
        id: s.id,
        type: "live-video",
        label: s.incidentId,
        lat: s.latitude,
        lng: s.longitude,
        status: s.status,
        detail: s.roomName,
      })),
    sos: sosEvents
      .filter((e) => e.gps.lat && e.gps.lng)
      .map((e) => ({
        id: e.id,
        type: "sos",
        label: e.user,
        lat: e.gps.lat,
        lng: e.gps.lng,
        status: e.status,
        detail: e.deviceId,
      })),
    policeStations: policeStations.slice(0, 30).map((s) => ({
      id: s.id,
      type: "police",
      label: s.name,
      lat: s.latitude,
      lng: s.longitude,
      status: s.agencyType,
      detail: s.address,
    })),
    devices: devices
      .filter((d) => d.lastGps.lat && d.lastGps.lng)
      .map((d) => ({
        id: d.id,
        type: "smartwatch",
        label: d.owner,
        lat: d.lastGps.lat,
        lng: d.lastGps.lng,
        status: d.status,
        detail: d.deviceId,
      })),
  };
}
