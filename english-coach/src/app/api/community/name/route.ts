export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

// GET: nome exibido para outros usuários (posts, perfil, chat, etc.)
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase.from("user_xp").select("display_name").eq("user_id", userId).maybeSingle();

  return NextResponse.json({ displayName: data?.display_name ?? null });
}

// POST: define/atualiza o nome exibido para outros usuários
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { displayName } = await req.json();
  if (!displayName || typeof displayName !== "string") {
    return NextResponse.json({ error: "Nome inválido" }, { status: 400 });
  }

  const clean = displayName.trim().replace(/\s+/g, " ").slice(0, 40);
  if (clean.length < 2) {
    return NextResponse.json({ error: "Nome muito curto (mínimo 2 caracteres)" }, { status: 400 });
  }

  const { error } = await supabase
    .from("user_xp")
    .upsert({ user_id: userId, display_name: clean }, { onConflict: "user_id" });

  if (error) return NextResponse.json({ error: "Erro ao salvar nome" }, { status: 500 });

  return NextResponse.json({ displayName: clean });
}
