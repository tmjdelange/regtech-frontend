import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession } from "../../../../../lib/adminAuth";

type Params = { params: Promise<{ id: string }> };

async function forward(id: string, init: RequestInit = {}) {
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid document id" }, { status: 400 });
  }

  const res = await fetch(`${process.env.BACKEND_URL}/admin/documents/${id}`, {
    ...init,
    headers: {
      ...init.headers,
      "X-API-Key": process.env.BACKEND_ADMIN_API_KEY!,
    },
  });

  // DELETE answers 204 with no body.
  if (res.status === 204) {
    return new NextResponse(null, { status: 204 });
  }
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function GET(_request: NextRequest, { params }: Params) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  return forward(id);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json();
  return forward(id, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  return forward(id, { method: "DELETE" });
}
