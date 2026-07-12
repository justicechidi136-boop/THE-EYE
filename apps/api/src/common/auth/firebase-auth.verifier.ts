import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { assertFirebaseProjectConfigured } from "./firebase-project";
import { verifyFirebaseIdToken, type VerifiedFirebaseIdentity } from "./firebase-id-token";

@Injectable()
export class FirebaseAuthVerifier {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async verify(idToken: string, expectedProvider: "google.com" | "apple.com"): Promise<VerifiedFirebaseIdentity> {
    const projectId = assertFirebaseProjectConfigured(this.config);

    const identity = await verifyFirebaseIdToken(idToken, projectId);
    if (identity.provider !== expectedProvider) {
      throw new Error("Firebase provider does not match requested provider");
    }
    return identity;
  }
}
