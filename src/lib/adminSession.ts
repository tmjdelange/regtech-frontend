import { createHmac, timingSafeEqual } from "crypto";

export const ADMIN_SESSION_COOKIE = "admin_session";

const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours
export const ADMIN_SESSION_MAX_AGE_SECONDS = SESSION_DURATION_MS / 1000;

function sign(payload: string): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is not set");
  }
  return createHmac("sha256", secret).update(payload).digest("hex");
}

// Cookie value is "<expiresAtMs>.<hmac>". Signing the plain expiry (rather
// than, say, a user id) is enough: there's exactly one admin identity, and
// the signature alone proves the value wasn't forged or extended client-side.
export function createSessionCookieValue(): string {
  const payload = String(Date.now() + SESSION_DURATION_MS);
  return `${payload}.${sign(payload)}`;
}

export function isSessionValid(cookieValue: string | undefined | null): boolean {
  if (!cookieValue) return false;

  const dot = cookieValue.lastIndexOf(".");
  if (dot === -1) return false;

  const payload = cookieValue.slice(0, dot);
  const signature = cookieValue.slice(dot + 1);

  let expectedSignature: string;
  try {
    expectedSignature = sign(payload);
  } catch {
    return false;
  }

  const signatureBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (signatureBuf.length !== expectedBuf.length) return false;
  if (!timingSafeEqual(signatureBuf, expectedBuf)) return false;

  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && Date.now() < expiresAt;
}
