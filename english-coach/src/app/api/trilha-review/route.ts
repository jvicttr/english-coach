import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
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
    .select("completed_at")
    .eq("user_id", userId)
    .eq("step_id", stepId)
    .single();

  const completedAt = progress?.completed_at as string | undefined;

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

  // Fetch quiz: find by completion date (same day as step, or most recent overall)
  let quiz = null;
  if (completedAt) {
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
  // Fallback: most recent completed quiz
  if (!quiz) {
    const { data } = await supabase
      .from("quiz_results")
      .select("title, questions, answers, score")
      .eq("user_id", userId)
      .not("score", "is", null)
      .not("answers", "is", null)
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

