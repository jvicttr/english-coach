export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
// Use untyped client to avoid TypeScript errors on the `handle` column (added via raw SQL)
const db = supabase as any;

// GET: fetch current user's handle
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await db.from("user_xp").select("handle").eq("user_id", userId).maybeSingle();

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

  // Check uniqueness (case-insensitive)
  const { data: existing } = await db
    .from("user_xp")
    .select("user_id")
    .filter("handle", "ilike", clean)
    .maybeSingle();

  if (existing && existing.user_id !== userId) {
    return NextResponse.json({ error: "Esse @ já está em uso por outro usuário" }, { status: 409 });
  }

  const { error: saveError } = await db
    .from("user_xp")
    .upsert({ user_id: userId, handle: clean }, { onConflict: "user_id" });

  // Catch DB-level unique constraint violation (race condition)
  if (saveError) {
    if (saveError.code === "23505") {
      return NextResponse.json({ error: "Esse @ já está em uso por outro usuário" }, { status: 409 });
    }
    return NextResponse.json({ error: "Erro ao salvar handle" }, { status: 500 });
  }

  return NextResponse.json({ handle: clean });
}
