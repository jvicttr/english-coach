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
    .like("pack_name", `${step.title} ·%`)
    .order("created_at", { ascending: false })
    .limit(20);

  // Group by pack_id to get the most recent pack
  let flashcards: typeof allCards = [];
  if (allCards && allCards.length > 0) {
    const firstPackId = allCards[0].pack_id;
    flashcards = allCards.filter((c) => c.pack_id === firstPackId);
  }

  // Fetch quiz: busca dentro de uma janela de 3 dias antes até o momento de conclusão da etapa
  // Isso cobre casos em que o quiz foi feito um dia antes de finalizar o chat2
  let quiz = null;
  if (completedAt) {
    const endDate = new Date(completedAt);
    const startDate = new Date(completedAt);
    startDate.setDate(startDate.getDate() - 3);
    const { data } = await supabase
      .from("quiz_results")
      .select("title, questions, answers, score")
      .eq("user_id", userId)
      .not("score", "is", null)
      .not("answers", "is", null)
      .gte("completed_at", startDate.toISOString())
      .lte("completed_at", endDate.toISOString())
      .order("completed_at", { ascending: false })
      .limit(1)
      .single();
    quiz = data;
  }
  // Sem fallback global — melhor não mostrar nada do que mostrar o quiz errado

  return NextResponse.json({
    flashcards: flashcards ?? [],
    quiz: quiz ? { quiz: { title: quiz.title, questions: quiz.questions }, answers: quiz.answers, score: quiz.score } : null,
  });
}

