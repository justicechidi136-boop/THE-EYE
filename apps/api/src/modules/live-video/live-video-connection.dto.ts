export type LiveVideoConnectionDto = {
  serverUrl: string;
  participantToken: string;
  participantIdentity: string;
  roomName: string;
  expiresAt: string | null;
};

export function buildLiveVideoConnectionDto(input: {
  serverUrl: string;
  participantToken: string;
  participantIdentity: string;
  roomName: string;
  expiresAt: string | null;
}): LiveVideoConnectionDto {
  return {
    serverUrl: input.serverUrl,
    participantToken: input.participantToken,
    participantIdentity: input.participantIdentity,
    roomName: input.roomName,
    expiresAt: input.expiresAt,
  };
}
