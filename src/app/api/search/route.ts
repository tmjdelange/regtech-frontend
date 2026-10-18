import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const qs = new URLSearchParams();
  for (const key of ["query", "destination", "origin"]) {
    const value = params.get(key);
    if (value !== null) qs.set(key, value);
  }

  const res = await fetch(
    `${process.env.BACKEND_URL}/documents/search?${qs.toString()}`,
    {
      headers: { "X-API-Key": process.env.BACKEND_API_KEY! },
    }
  );

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
