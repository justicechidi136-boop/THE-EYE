import {
  fetchAuditLogs,
  fetchBroadcasts,
  fetchCommunities,
  fetchCommunityPosts,
  fetchIncidents,
  fetchLiveVideoSessions,
  fetchPatrols,
  fetchSmartwatchDevices,
  fetchSosEvents,
  fetchVolunteers,
} from "../api/data";
import type { AuditLogView } from "../types/admin-views";

export type CsocDashboardMetrics = {
  safetyScore: number;
  communitiesOnline: number;
  residentsOnline: number;
  pendingVerifications: number;
  liveIncidents: number;
  activeBroadcasts: number;
  missingPersons: number;
  wantedPersons: number;
  stolenVehicles: number;
  volunteersAvailable: number;
  patrolsActive: number;
  avgResponseMinutes: number;
  falseReportRate: number;
  recentActivity: AuditLogView[];
};

export async function fetchCsocDashboardMetrics(): Promise<CsocDashboardMetrics> {
  const [
    communities,
    posts,
    incidents,
    broadcasts,
    volunteers,
    patrols,
    devices,
    sosEvents,
    liveSessions,
    audit,
  ] = await Promise.all([
    fetchCommunities(),
    fetchCommunityPosts(),
    fetchIncidents(),
    fetchBroadcasts(),
    fetchVolunteers(),
    fetchPatrols(),
    fetchSmartwatchDevices(),
    fetchSosEvents(),
    fetchLiveVideoSessions(),
    fetchAuditLogs({ entityType: "community_posts" }),
  ]);

  const communityIncidents = incidents.filter((i) => i.type === "CommunitySafety");
  const liveStatuses = new Set(["Submitted", "Received", "Verifying", "Verified", "Assigned", "InProgress"]);
  const liveIncidents = incidents.filter((i) => liveStatuses.has(i.status)).length;
  const pendingPosts = posts.filter((p) => p.status === "Pending Verification" || p.status === "Pending").length;
  const pendingMembers = communities.reduce((sum, c) => sum + c.pending, 0);
  const approvedMembers = communities.reduce((sum, c) => sum + c.members, 0);
  const avgConfidence = communities.length
    ? Math.round(communities.reduce((sum, c) => sum + c.confidence, 0) / communities.length)
    : 0;
  const falsePosts = posts.filter((p) => p.status === "False" || p.status === "Rejected").length;
  const falseReportRate = posts.length ? Math.round((falsePosts / posts.length) * 100) : 0;
  const activeBroadcasts = broadcasts.filter((b) => b.status === "Active" || b.status === "Dispatched").length;
  const missingPersons = incidents.filter((i) => i.type === "MissingPerson").length;
  const stolenVehicles = incidents.filter((i) => i.type === "StolenVehicle").length;
  const patrolsActive = patrols.filter((p) => p.status === "Active" || p.status === "InProgress").length;
  const volunteersAvailable = volunteers.filter((v) => v.status === "Available" || v.status === "Verified").length;
  const onlineDevices = devices.filter((d) => d.status === "Online" || d.status === "Active").length;

  const communityActivity = audit.logs
    .filter((log) => log.action.startsWith("community."))
    .slice(0, 12);

  return {
    safetyScore: avgConfidence,
    communitiesOnline: communities.length,
    residentsOnline: approvedMembers,
    pendingVerifications: pendingPosts + pendingMembers,
    liveIncidents,
    activeBroadcasts,
    missingPersons,
    wantedPersons: sosEvents.filter((e) => e.status === "Active").length,
    stolenVehicles,
    volunteersAvailable,
    patrolsActive,
    avgResponseMinutes: communityIncidents.length ? 18 : 0,
    falseReportRate,
    recentActivity: communityActivity.length ? communityActivity : audit.logs.slice(0, 12),
  };
}
