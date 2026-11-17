import { NextRequest, NextResponse } from "next/server";

// The visitor's address, so the backend can rate limit per visitor rather
// than per frontend server. On Vercel the first x-forwarded-for entry is the
// client address set by the platform.
function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim() || null;
  return request.headers.get("x-real-ip");
}

// Passes the multipart upload through unchanged. The files are held in
// memory for the duration of the request and never stored.
export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return NextResponse.json(
      { error: "Send the files as multipart/form-data" },
      { status: 400 }
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "X-API-Key": process.env.BACKEND_API_KEY!,
  };
  const ip = clientIp(request);
  if (ip) headers["X-Client-IP"] = ip;

  let res: Response;
  try {
    res = await fetch(`${process.env.BACKEND_URL}/extract`, {
      method: "POST",
      headers,
      body: await request.arrayBuffer(),
    });
  } catch {
    return NextResponse.json(
      { error: "The extraction service is unreachable" },
      { status: 502 }
    );
  }

  const data = await res.json().catch(() => null);
  if (data === null) {
    return NextResponse.json(
      { error: "The extraction service returned an unexpected response" },
      { status: 502 }
    );
  }
  return NextResponse.json(data, { status: res.status });
}
