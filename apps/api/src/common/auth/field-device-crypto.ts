import { createPublicKey, verify } from "crypto";

export function verifyFieldDeviceSignature(
  publicKeyBase64: string,
  message: string,
  signatureBase64: string,
): boolean {
  try {
    const publicKey = createPublicKey({
      key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(publicKeyBase64, "base64")]),
      format: "der",
      type: "spki",
    });
    return verify(null, Buffer.from(message, "utf8"), publicKey, Buffer.from(signatureBase64, "base64"));
  } catch {
    return false;
  }
}
