import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query") ?? "";

  const res = await fetch(
    `${process.env.BACKEND_URL}/documents/search?query=${encodeURIComponent(query)}`,
    {
      headers: { "X-API-Key": process.env.BACKEND_API_KEY! },
    }
  );

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}