export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  const allowedHost = new URL(process.env.SUPABASE_URL!).host;
  if (parsed.host !== allowedHost) {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  const res = await fetch(url);
  if (!res.ok) return NextResponse.json({ error: "Falha ao buscar o PDF" }, { status: 502 });

  const buffer = Buffer.from(await res.arrayBuffer());
  const base64 = buffer.toString("base64");
  return NextResponse.json({ base64 });
}
