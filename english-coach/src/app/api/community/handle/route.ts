export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

// GET: fetch current user's handle
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("user_xp")
    .select("handle")
    .eq("user_id", userId)
    .maybeSingle();

  return NextResponse.json({ handle: data?.handle ?? null });
}

// POST: set/update handle
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { handle } = await req.json();
  if (!handle || typeof handle !== "string") {
    return NextResponse.json({ error: "Handle inválido" }, { status: 400 });
  }

  const clean = handle.toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 30);
  if (clean.length < 2) {
    return NextResponse.json({ error: "Handle muito curto (mínimo 2 caracteres)" }, { status: 400 });
  }

  // Check uniqueness
  const { data: existing } = await supabase
    .from("user_xp")
    .select("user_id")
    .ilike("handle", clean)
    .maybeSingle();

  if (existing && existing.user_id !== userId) {
    return NextResponse.json({ error: "Esse handle já está em uso" }, { status: 409 });
  }

  await supabase
    .from("user_xp")
    .upsert({ user_id: userId, handle: clean }, { onConflict: "user_id" });

  return NextResponse.json({ handle: clean });
}
