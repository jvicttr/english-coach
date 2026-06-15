import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { TRAIL_STEPS } from "@/lib/trilha-steps";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stepId = req.nextUrl.searchParams.get("stepId");
  if (!stepId) return NextResponse.json({ error: "Missing stepId" }, { status: 400 });

  const step = TRAIL_STEPS.find((s) => s.id === stepId);
  if (!step) return NextResponse.json({ error: "Invalid step" }, { status: 400 });

  // Get step completion date from learning_path_progress
  const { data: progress } = await supabase
    .from("learning_path_progress")
    .select("completed_at, quiz_session_id")
    .eq("user_id", userId)
    .eq("step_id", stepId)
    .single();

  const completedAt = progress?.completed_at as string | undefined;
  const quizSessionId = progress?.quiz_session_id as string | undefined;

  // Fetch flashcards by pack_name matching step title (most recent pack)
  const { data: allCards } = await supabase
    .from("flashcards")
    .select("word, translation, phonetic, example, example_translation, pack_id, created_at")
    .eq("user_id", userId)
    .eq("pack_name", step.title)
    .order("created_at", { ascending: false })
    .limit(20);

  // Group by pack_id to get the most recent pack
  let flashcards: typeof allCards = [];
  if (allCards && allCards.length > 0) {
    const firstPackId = allCards[0].pack_id;
    flashcards = allCards.filter((c) => c.pack_id === firstPackId);
  }

  // Fetch quiz: prefer by quiz_session_id, else by completion date window
  let quiz = null;
  if (quizSessionId) {
    const { data } = await supabase
      .from("quiz_results")
      .select("title, questions, answers, score")
      .eq("id", quizSessionId)
      .eq("user_id", userId)
      .single();
    quiz = data;
  } else if (completedAt) {
    // Fallback: find quiz completed on the same day as the step
    const day = completedAt.split("T")[0];
    const { data } = await supabase
      .from("quiz_results")
      .select("title, questions, answers, score")
      .eq("user_id", userId)
      .not("score", "is", null)
      .not("answers", "is", null)
      .gte("completed_at", `${day}T00:00:00`)
      .lte("completed_at", `${day}T23:59:59`)
      .order("completed_at", { ascending: false })
      .limit(1)
      .single();
    quiz = data;
  }

  return NextResponse.json({
    flashcards: flashcards ?? [],
    quiz: quiz ? { quiz: { title: quiz.title, questions: quiz.questions }, answers: quiz.answers, score: quiz.score } : null,
  });
}

// PATCH: save quiz_session_id to learning_path_progress for future lookups
export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { stepId, quizSessionId } = await req.json();
  if (!stepId || !quizSessionId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  await supabase
    .from("learning_path_progress")
    .update({ quiz_session_id: quizSessionId })
    .eq("user_id", userId)
    .eq("step_id", stepId);

  return NextResponse.json({ ok: true });
}
