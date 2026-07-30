import "server-only";

import { createHash, randomBytes } from "node:crypto";

export function hashAdmissionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createAdmissionToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashAdmissionToken(token) };
}
