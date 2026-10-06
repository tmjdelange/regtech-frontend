import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession } from "../../../../lib/adminAuth";

export async function GET(request: NextRequest) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const qs = new URLSearchParams();
  for (const key of ["limit", "offset"]) {
    const value = params.get(key);
    if (value !== null) qs.set(key, value);
  }

  const res = await fetch(
    `${process.env.BACKEND_URL}/admin/documents?${qs.toString()}`,
    { headers: { "X-API-Key": process.env.BACKEND_ADMIN_API_KEY! } }
  );

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
