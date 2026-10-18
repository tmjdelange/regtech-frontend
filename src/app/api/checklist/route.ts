import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  let profile: unknown;
  try {
    profile = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const params = request.nextUrl.searchParams;
  const qs = new URLSearchParams();
  for (const key of ["destination", "origin"]) {
    const value = params.get(key);
    if (value !== null) qs.set(key, value);
  }

  let res: Response;
  try {
    res = await fetch(`${process.env.BACKEND_URL}/checklist/evaluate?${qs.toString()}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.BACKEND_API_KEY!,
      },
      body: JSON.stringify(profile),
    });
  } catch {
    return NextResponse.json(
      { error: "The checklist service is unreachable" },
      { status: 502 }
    );
  }

  const data = await res.json().catch(() => null);
  if (data === null) {
    return NextResponse.json(
      { error: "The checklist service returned an unexpected response" },
      { status: 502 }
    );
  }
  return NextResponse.json(data, { status: res.status });
}
