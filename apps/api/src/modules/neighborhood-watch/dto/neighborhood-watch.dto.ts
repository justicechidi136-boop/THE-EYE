import { BadRequestException } from "@nestjs/common";
import type { CursorPageQuery } from "../../../common/pagination/cursor-pagination";

export type CreateCommunityDto = {
  parentId?: string;
  jurisdictionId?: string;
  name: string;
  level: "Country" | "State" | "LGA" | "Ward" | "Community" | "Estate" | "Street";
  visibility?: "Public" | "Private";
  country: string;
  state?: string;
  lga?: string;
  ward?: string;
  estate?: string;
  street?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  boundaryWkt?: string;
};

export type CreateCommunityPostDto = {
  type:
    | "SuspiciousActivity"
    | "LostChild"
    | "MissingPerson"
    | "CrimeAlert"
    | "AccidentAlert"
    | "FireAlert"
    | "FloodWarning"
    | "CommunityAnnouncement"
    | "SecurityMeeting"
    | "PatrolUpdate"
    | "SafetyTip"
    | "Discussion"
    | "LocalWarning"
    | "RoadHazard"
    | "CommunityQuestion";
  title: string;
  body: string;
  latitude?: number;
  longitude?: number;
  hazardStatus?: "Open" | "Verified" | "Ongoing" | "Resolved" | "Dismissed";
  media?: Array<{ mediaType: "Image" | "Video" | "Audio" | "Document"; bucket: string; objectKey: string; contentType: string; fileHash: string }>;
  clientMessageId?: string;
  replyToPostId?: string;
};

export type UpdateCommunityPostDto = {
  body: string;
};

export type VerifyCommunityPostDto = {
  status: "PendingVerification" | "Verified" | "Disputed" | "FalseInformation";
  moderatorConfirmed?: boolean;
  note?: string;
};

export type RegisterVolunteerDto = {
  communityId?: string;
  types: Array<"Doctor" | "Nurse" | "FirstAid" | "Lawyer" | "SecurityVolunteer" | "FireVolunteer" | "SearchAndRescue" | "BloodDonor">;
  latitude?: number;
  longitude?: number;
};

const allowedVolunteerTypes = new Set<RegisterVolunteerDto["types"][number]>([
  "Doctor",
  "Nurse",
  "FirstAid",
  "Lawyer",
  "SecurityVolunteer",
  "FireVolunteer",
  "SearchAndRescue",
  "BloodDonor",
]);

export type CreatePatrolScheduleDto = {
  title: string;
  startsAt: string;
  endsAt: string;
  volunteerUserIds?: string[];
};

export type PatrolCheckpointDto = {
  label: string;
  latitude: number;
  longitude: number;
};

export type SendCommunityMessageDto = {
  body: string;
};

export type ListCommunitiesQuery = {
  search?: string;
  country?: string;
  state?: string;
  lga?: string;
  status?: string;
  cursor?: string;
  limit?: string;
  latitude?: string;
  longitude?: string;
};

export type CreateCommunityRequestDto = {
  name: string;
  description?: string;
  country: string;
  state?: string;
  lga?: string;
  ward?: string;
  estate?: string;
  street?: string;
  visibility?: "Public" | "Private";
  latitude?: number;
  longitude?: number;
};

export type ReviewCommunityRequestDto = {
  action: "approve" | "reject";
  rejectionNote?: string;
};

export type CreateCommunityCommentDto = {
  body?: string;
  mediaType?: "Audio" | "Image";
  bucket?: string;
  objectKey?: string;
  contentType?: string;
  durationSeconds?: number;
};

export type UpdateCommunityCommentDto = {
  body: string;
};

export type CreateCommunityReactionDto = {
  type: "Confirm" | "Helpful" | "Praying" | "Dispute" | "Seen";
};

export type CreateCommunityAlertDto = {
  title: string;
  body: string;
  audience?: "EntireCommunity" | "SelectedZone" | "Radius500m" | "Radius1km" | "WatchTeamOnly";
  radiusM?: number;
  latitude?: number;
  longitude?: number;
  expiresAt?: string;
};

export type UpdateCommunityAlertDto = {
  title?: string;
  body?: string;
  audience?: CreateCommunityAlertDto["audience"];
  radiusM?: number;
  latitude?: number;
  longitude?: number;
  expiresAt?: string | null;
  status?: "Active" | "Cancelled" | "Expired";
};

export type SetHomeCommunityDto = {
  communityId?: string | null;
};

export type CreatePinnedSafetyInfoDto = {
  title: string;
  body: string;
  category: string;
  sortOrder?: number;
};

export type UpdatePinnedSafetyInfoDto = {
  title?: string;
  body?: string;
  category?: string;
  sortOrder?: number;
  active?: boolean;
};

export type CreateCommunityContentReportDto = {
  targetType: "Post" | "Comment" | "Member" | "Community";
  targetId: string;
  reasonCode: string;
  note?: string;
  evidenceObjectKey?: string;
  evidenceBucket?: string;
};

export type ModerateMemberDto = {
  action: "suspend" | "restore" | "ban" | "unban";
  note?: string;
};

export type PresignCommunityMediaDto = {
  fileName: string;
  contentType: string;
  mediaType: "Image" | "Video" | "Audio" | "Document";
  sizeBytes?: number;
};

export type ListMembersQuery = CursorPageQuery & {
  search?: string;
};

export type UpdateCommunityDto = {
  name?: string;
  description?: string;
  visibility?: "Public" | "Private";
  country?: string;
  state?: string;
  lga?: string;
  ward?: string;
  estate?: string;
  street?: string;
  status?: "Active" | "Archived" | "Suspended";
  latitude?: number;
  longitude?: number;
  boundaryWkt?: string;
};

export type ListAdminMembershipsQuery = CursorPageQuery & {
  status?: string;
  communityId?: string;
  q?: string;
};

export type UpdateVolunteerAdminDto = {
  communityId?: string | null;
  types?: RegisterVolunteerDto["types"];
  verified?: boolean;
  available?: boolean;
  latitude?: number;
  longitude?: number;
};

export type UpdatePatrolScheduleDto = {
  status?: "Scheduled" | "Active" | "Paused" | "Completed" | "Cancelled";
  title?: string;
  startsAt?: string;
  endsAt?: string;
};

export type CreatePatrolObservationDto = {
  note: string;
  latitude?: number;
  longitude?: number;
};

export const COMMUNITY_REPORT_REASONS = [
  "Harassment",
  "Spam",
  "FalseInformation",
  "HateSpeech",
  "ViolenceThreat",
  "Impersonation",
  "PrivacyViolation",
  "Other",
] as const;

export type AssignCommunityRoleDto = {
  roleName:
    | "CommunityModerator"
    | "EstateAdmin"
    | "SecurityCoordinator"
    | "PoliceLiaison"
    | "VolunteerCoordinator"
    | "VerifiedVolunteer"
    | "Resident";
};

export type RejectMembershipDto = {
  note?: string;
};

export function validateCommunityRequest(dto: CreateCommunityRequestDto) {
  validateCommunity({
    name: dto.name,
    level: "Community",
    country: dto.country,
    state: dto.state,
    lga: dto.lga,
    ward: dto.ward,
    estate: dto.estate,
    street: dto.street,
    description: dto.description,
    latitude: dto.latitude,
    longitude: dto.longitude,
  });
}

export function validateCommunity(dto: CreateCommunityDto) {
  if (!dto.name || dto.name.trim().length < 2) throw new BadRequestException("Community name is required");
  if (!dto.country) throw new BadRequestException("Country is required");
  if (dto.latitude !== undefined) assertCoordinate(dto.latitude, "latitude", -90, 90);
  if (dto.longitude !== undefined) assertCoordinate(dto.longitude, "longitude", -180, 180);
}

export function validatePost(dto: CreateCommunityPostDto) {
  if (!dto.title || dto.title.trim().length < 4) throw new BadRequestException("Post title is required");
  const hasMediaBody =
    Array.isArray(dto.media) &&
    dto.media.some((item) => item.mediaType === "Audio" || item.mediaType === "Image" || item.mediaType === "Video");
  const minimumBodyLength = dto.type === "Discussion" ? 1 : 5;
  if ((!dto.body || dto.body.trim().length < minimumBodyLength) && !hasMediaBody) {
    throw new BadRequestException("Post body or voice/photo/video attachment is required");
  }
  if (dto.clientMessageId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(dto.clientMessageId)) {
    throw new BadRequestException("clientMessageId must be a UUID");
  }
  if (dto.replyToPostId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(dto.replyToPostId)) {
    throw new BadRequestException("replyToPostId must be a UUID");
  }
  if (dto.latitude !== undefined) assertCoordinate(dto.latitude, "latitude", -90, 90);
  if (dto.longitude !== undefined) assertCoordinate(dto.longitude, "longitude", -180, 180);
}

/** Conversation-family types that emit NW_NEW_DISCUSSION. */
export const NW_DISCUSSION_POST_TYPES = new Set<CreateCommunityPostDto["type"]>([
  "Discussion",
  "SafetyTip",
  "CommunityQuestion",
  "LocalWarning",
  "RoadHazard",
  "SuspiciousActivity",
]);

export function validateRegisterVolunteer(dto: RegisterVolunteerDto) {
  if (!dto.types?.length) throw new BadRequestException("At least one volunteer category is required");
  for (const type of dto.types) {
    if (!allowedVolunteerTypes.has(type)) {
      throw new BadRequestException(`Unsupported volunteer type: ${type}`);
    }
  }
  if (dto.latitude !== undefined) assertCoordinate(dto.latitude, "latitude", -90, 90);
  if (dto.longitude !== undefined) assertCoordinate(dto.longitude, "longitude", -180, 180);
}

function assertCoordinate(value: unknown, label: string, min: number, max: number): asserts value is number {
  if (typeof value !== "number" || Number.isNaN(value) || value < min || value > max) {
    throw new BadRequestException(`${label} must be between ${min} and ${max}`);
  }
}
