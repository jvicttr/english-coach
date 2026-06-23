import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

// GET /api/trilha-session?stepId=xxx  → single session
// GET /api/trilha-session             → all active sessions for user
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ session: null, sessions: [] });

  const { searchParams } = new URL(req.url);
  const stepId = searchParams.get("stepId");

  if (stepId) {
    const { data } = await supabase
      .from("trilha_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("step_id", stepId)
      .single();
    return NextResponse.json({ session: data ?? null });
  }

  const { data } = await supabase
    .from("trilha_sessions")
    .select("step_id, msg_count, phase")
    .eq("user_id", userId);
  return NextResponse.json({ sessions: data ?? [] });
}

// POST /api/trilha-session → upsert session
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { stepId, messages, msgCount, phase, flashcardIndex, flashcardFlipped, quizData } = await req.json();
  if (!stepId) return NextResponse.json({ error: "Missing stepId" }, { status: 400 });

  await supabase.from("trilha_sessions").upsert(
    {
      user_id: userId,
      step_id: stepId,
      messages: messages ?? [],
      msg_count: msgCount ?? 0,
      phase: phase ?? "chat1",
      flashcard_index: flashcardIndex ?? null,
      flashcard_flipped: flashcardFlipped ?? null,
      quiz_data: quizData ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,step_id" }
  );

  return NextResponse.json({ ok: true });
}

// DELETE /api/trilha-session → remove session (user completed or restarted)
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { stepId } = await req.json();
  if (!stepId) return NextResponse.json({ error: "Missing stepId" }, { status: 400 });

  await supabase.from("trilha_sessions").delete().eq("user_id", userId).eq("step_id", stepId);

  return NextResponse.json({ ok: true });
}
