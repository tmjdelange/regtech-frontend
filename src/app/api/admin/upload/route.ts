import { NextResponse } from "next/server";
import { hasAdminSession } from "../../../../lib/adminAuth";

// Vercel's request body limit is ~4.5 MB; stay under it with some margin.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".csv", ".json"];

export async function POST(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  if (!ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return NextResponse.json(
      { error: "Only .csv or .json files are accepted" },
      { status: 400 }
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "File exceeds the 4 MB upload limit" },
      { status: 413 }
    );
  }

  const forwardBody = new FormData();
  forwardBody.set("file", file, file.name);

  const res = await fetch(`${process.env.BACKEND_URL}/admin/documents/bulk`, {
    method: "POST",
    headers: { "X-API-Key": process.env.BACKEND_ADMIN_API_KEY! },
    body: forwardBody,
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
