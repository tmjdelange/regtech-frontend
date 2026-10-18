import { NextResponse } from "next/server";

export async function GET() {
  let res: Response;
  try {
    // no-store: a destination appears as soon as a row is verified.
    res = await fetch(`${process.env.BACKEND_URL}/countries`, {
      headers: { "X-API-Key": process.env.BACKEND_API_KEY! },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: "The country list is unreachable" },
      { status: 502 }
    );
  }

  const data = await res.json().catch(() => null);
  if (data === null) {
    return NextResponse.json(
      { error: "The country list returned an unexpected response" },
      { status: 502 }
    );
  }
  return NextResponse.json(data, { status: res.status });
}
