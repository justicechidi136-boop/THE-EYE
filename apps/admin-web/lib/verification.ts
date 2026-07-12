export type VerificationStatus = "Verified" | "Pending" | "Disputed" | "False Information";

export function verificationStatusFromScore(score: number, status?: string): VerificationStatus {
  if (status === "Disputed") return "Disputed";
  if (status === "False Information" || status === "Rejected") return "False Information";
  if (score >= 85 || status === "Verified") return "Verified";
  return "Pending";
}

export function verificationStatusTone(status: VerificationStatus): "success" | "warning" | "danger" | "info" {
  if (status === "Verified") return "success";
  if (status === "Pending") return "warning";
  if (status === "Disputed") return "info";
  return "danger";
}
