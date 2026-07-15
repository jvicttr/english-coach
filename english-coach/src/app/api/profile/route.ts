export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ level: null });

  const { data } = await supabase
    .from("subscriptions")
    .select("english_level")
    .eq("user_id", userId)
    .single();

  return NextResponse.json({ level: data?.english_level ?? null });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { level } = await req.json();

  // Mantém level (usado pelo chat/roleplay/quiz/flashcards) sincronizado com este campo
  const levelMap: Record<string, string> = {
    iniciante: "beginner",
    basico: "elementary",
    intermediario: "intermediate",
    avancado: "advanced",
  };

  await supabase
    .from("subscriptions")
    .upsert({ user_id: userId, english_level: level, level: levelMap[level] }, { onConflict: "user_id" });

  return NextResponse.json({ ok: true });
}
