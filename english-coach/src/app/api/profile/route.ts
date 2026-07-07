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

  // Mantém level (3 niveis, usado pelo chat/roleplay) sincronizado com este campo
  const levelMap: Record<string, string> = {
    iniciante: "beginner",
    basico: "beginner",
    intermediario: "intermediate",
    avancado: "advanced",
  };

  await supabase
    .from("subscriptions")
    .upsert({ user_id: userId, english_level: level, level: levelMap[level] }, { onConflict: "user_id" });

  return NextResponse.json({ ok: true });
}
