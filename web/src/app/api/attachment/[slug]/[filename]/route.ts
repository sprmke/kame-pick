import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; filename: string }> },
) {
  const { slug, filename } = await params;
  const headers: Record<string, string> = {};

  const supabase = await createClient();
  if (supabase) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
  }

  const res = await fetch(
    `${API_BASE}/candidates/${encodeURIComponent(slug)}/attachment/${encodeURIComponent(filename)}`,
    { headers, cache: "no-store" },
  );

  if (!res.ok) {
    return NextResponse.json({ error: "Attachment not found" }, { status: res.status });
  }

  const data = await res.arrayBuffer();
  return new NextResponse(data, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "application/pdf",
      "Content-Disposition": res.headers.get("Content-Disposition") || "inline",
    },
  });
}
