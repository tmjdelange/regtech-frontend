import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession } from "../../../../../../lib/adminAuth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const res = await fetch(
    `${process.env.BACKEND_URL}/admin/documents/${id}/verified`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.BACKEND_ADMIN_API_KEY!,
      },
      body: JSON.stringify(body),
    }
  );

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
