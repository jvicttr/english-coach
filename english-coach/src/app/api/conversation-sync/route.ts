import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

// GET /api/conversation-sync → cross-device "cleared at" markers for free/thematic
// chat and role-play, whose message history itself only lives in localStorage.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("user_xp")
    .select("chat_cleared_at, roleplay_cleared_at")
    .eq("user_id", userId)
    .single();

  return NextResponse.json({
    chatClearedAt: data?.chat_cleared_at ?? null,
    roleplayClearedAt: data?.roleplay_cleared_at ?? null,
  });
}

// POST /api/conversation-sync { type: "chat" | "roleplay" } → records that this user
// cleared their saved conversations just now, so other devices can pick it up.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type } = await req.json();
  if (type !== "chat" && type !== "roleplay") {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const clearedAt = new Date().toISOString();
  const column = type === "chat" ? "chat_cleared_at" : "roleplay_cleared_at";

  await supabase.from("user_xp").upsert(
    { user_id: userId, [column]: clearedAt },
    { onConflict: "user_id" }
  );

  return NextResponse.json({ clearedAt });
}
