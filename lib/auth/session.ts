import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "inzpo_session";
export const SESSION_MAX_AGE_SECONDS = 180 * 24 * 60 * 60; // fixed 180 days

function secret(): Uint8Array {
  return new TextEncoder().encode(process.env.AUTH_SESSION_SECRET!);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ sub: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS)
    .sign(secret());
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.sub === "owner";
  } catch {
    return false;
  }
}
