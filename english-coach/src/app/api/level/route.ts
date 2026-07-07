import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ level: null });

  const { data } = await supabase
    .from("subscriptions")
    .select("level")
    .eq("user_id", userId)
    .single();

  return NextResponse.json({ level: data?.level ?? null });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { level } = await req.json();
  if (!["beginner", "intermediate", "advanced"].includes(level)) {
    return NextResponse.json({ error: "Invalid level" }, { status: 400 });
  }

  // Mantém english_level (usado pela trilha de aprendizado) sincronizado com este campo
  const englishLevelMap: Record<string, string> = {
    beginner: "iniciante",
    intermediate: "intermediario",
    advanced: "avancado",
  };

  await supabase
    .from("subscriptions")
    .upsert(
      { user_id: userId, level, english_level: englishLevelMap[level], updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

  return NextResponse.json({ ok: true });
}
