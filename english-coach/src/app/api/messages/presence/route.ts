import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

// POST - Atualizar status online
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { isOnline, isTyping } = await req.json();

  const update: Record<string, any> = {
    user_id: userId,
    last_seen: new Date().toISOString(),
  };
  if (isOnline !== undefined) update.is_online = isOnline;
  if (isTyping !== undefined) {
    update.is_typing = isTyping;
    update.typing_at = isTyping ? new Date().toISOString() : null;
  }

  const { data, error } = await supabase
    .from("user_presence")
    .upsert(update, { onConflict: "user_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ presence: data });
}

// GET - Buscar usuários online
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userIds = searchParams.get("userIds")?.split(",");

  if (!userIds) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { data: presences, error } = await supabase
    .from("user_presence")
    .select("user_id, is_online, last_seen, is_typing, typing_at")
    .in("user_id", userIds);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  const enriched = (presences ?? []).map(p => ({
    ...p,
    is_online: p.is_online && (now - new Date(p.last_seen).getTime()) < 5 * 60 * 1000,
    is_typing: p.is_typing && p.typing_at && (now - new Date(p.typing_at).getTime()) < 4000,
  }));

  return NextResponse.json({ presences: enriched });
}
