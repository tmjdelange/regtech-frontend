import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createSessionCookieValue,
} from "../../../../lib/adminSession";

function constantTimeEquals(a: string, b: string): boolean {
  // timingSafeEqual requires equal-length buffers, and the real password
  // will rarely be the same length as a guess, so hash both sides to a
  // fixed 32 bytes first.
  const aHash = createHash("sha256").update(a).digest();
  const bHash = createHash("sha256").update(b).digest();
  return timingSafeEqual(aHash, bHash);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  const expected = process.env.ADMIN_PASSWORD ?? "";

  // Fixed delay regardless of outcome, so response timing can't be used to
  // distinguish a valid password from an invalid one.
  await new Promise((resolve) => setTimeout(resolve, 400));

  if (!expected || !constantTimeEquals(password, expected)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, createSessionCookieValue(), {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
  return response;
}
