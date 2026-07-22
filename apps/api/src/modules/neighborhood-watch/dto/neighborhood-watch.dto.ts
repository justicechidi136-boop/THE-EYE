import { BadRequestException } from "@nestjs/common";

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
    | "PatrolUpdate";
  title: string;
  body: string;
  latitude?: number;
  longitude?: number;
  media?: Array<{ mediaType: "Image" | "Video" | "Audio" | "Document"; bucket: string; objectKey: string; contentType: string; fileHash: string }>;
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
  body: string;
};

export type UpdateCommunityCommentDto = {
  body: string;
};

export type CreateCommunityReactionDto = {
  type: "Confirm" | "Dispute" | "Support" | "Concern";
};

export type CreateCommunityContentReportDto = {
  targetType: "Post" | "Comment" | "Member";
  targetId: string;
  reasonCode: string;
  note?: string;
};

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
  if (!dto.body || dto.body.trim().length < 5) throw new BadRequestException("Post body is required");
  if (dto.latitude !== undefined) assertCoordinate(dto.latitude, "latitude", -90, 90);
  if (dto.longitude !== undefined) assertCoordinate(dto.longitude, "longitude", -180, 180);
}

function assertCoordinate(value: unknown, label: string, min: number, max: number): asserts value is number {
  if (typeof value !== "number" || Number.isNaN(value) || value < min || value > max) {
    throw new BadRequestException(`${label} must be between ${min} and ${max}`);
  }
}
