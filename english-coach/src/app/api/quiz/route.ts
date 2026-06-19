import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { grantXP } from "@/lib/xp";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

const LEVEL_QUIZ_GUIDE: Record<string, string> = {
  beginner: `The student is a BEGINNER. Quiz rules for this level:
- Focus on basic vocabulary and simple present/past tense only
- Questions should test recognition ("Which word means...?", "Complete the sentence: I ___ to school")
- Options must use only high-frequency everyday words — no idioms, no phrasal verbs
- Wrong options should be plausible but clearly different (avoid trick questions)
- Keep questions short and direct — no complex grammar in the question itself
- Prefer translation-type questions ("Como se diz X em inglês?") and simple gap-fills`,

  intermediate: `The student is INTERMEDIATE. Quiz rules for this level:
- Mix grammar questions (tense choice, prepositions, articles) with vocabulary and phrases
- Include 1-2 phrasal verb or common expression questions from the conversation
- Wrong options should be plausibly confusing (e.g. "go" vs "went" vs "gone" vs "going")
- Questions can test understanding of context ("In this sentence, 'get along' means...?")
- Avoid trivial single-word questions — prefer phrases and expressions
- Difficulty: challenging but achievable for someone who communicates clearly despite some errors`,

  advanced: `The student is ADVANCED. Quiz rules for this level:
- Focus on nuance, idioms, collocations, and sophisticated vocabulary
- Test subtle grammar (conditionals, perfect aspects, passive voice usage, modal nuances)
- Wrong options must be near-synonyms or plausible near-correct forms (no obvious distractors)
- Include at least 2 questions about idiomatic expressions or register (formal vs casual)
- Can test word choice precision: "Which word fits best here and why?"
- Difficulty: would challenge a near-native speaker — no easy questions`,
};

function buildQuizPrompt(level: string): string {
  const guide = LEVEL_QUIZ_GUIDE[level] ?? LEVEL_QUIZ_GUIDE.intermediate;
  return `You are an English teacher creating a short review quiz based on a real conversation a student just had.

Analyze the conversation and create exactly 5 multiple-choice questions that review grammar, vocabulary, and expressions from this specific conversation.

${guide}

Rules for all levels:
- Each question must be directly tied to something from THIS conversation — no generic grammar drills
- 4 options each (A, B, C, D), only one correct
- Questions in Portuguese, options in English
- Never repeat the same structure across all 5 questions — vary question types
- The explanation must clearly say WHY the correct answer is right (in pt-BR)

Return ONLY valid JSON in this exact format, no markdown, no explanation:
{
  "title": "short title summarizing the conversation topic in Portuguese (max 5 words)",
  "questions": [
    {
      "question": "pergunta em português",
      "options": ["option A", "option B", "option C", "option D"],
      "correct": 0,
      "explanation": "brief explanation in Portuguese of why this is correct"
    }
  ]
}`;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
  const { messages, level, scenario, lessonContext, reviewId } = await req.json();

  const conversationText = messages?.length
    ? messages.map((m: { role: string; content: string }) => `${m.role === "user" ? "Student" : "Coach"}: ${m.content}`).join("\n")
    : lessonContext ?? "";

  const resolvedLevel = level || "intermediate";
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1200,
    system: buildQuizPrompt(resolvedLevel),
    messages: [
      {
        role: "user",
        content: `Student level: ${resolvedLevel}${scenario ? `\nScenario: ${scenario}` : ""}\n\nConversation:\n${conversationText}`,
      },
    ],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";

  // Strip markdown code blocks if model wrapped the JSON
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  let quiz;
  try {
    quiz = JSON.parse(cleaned);
  } catch (parseErr) {
    console.error("[quiz] parse error:", parseErr, "\nraw:", raw);
    return NextResponse.json({ error: "Failed to parse quiz" }, { status: 500 });
  }

  // Save session to Supabase (without answers yet)
  const baseInsert: Record<string, unknown> = {
    user_id: userId,
    title: quiz.title,
    level: level || "intermediate",
    questions: quiz.questions,
    score: null,
    completed_at: null,
    ...(reviewId ? { lesson_review_id: reviewId } : {}),
  };

  let saved: { id: string } | null = null;
  let insertError: { message: string } | null = null;

  // Try with optional source column first; fall back without it if column doesn't exist
  ({ data: saved, error: insertError } = await supabase
    .from("quiz_results")
    .insert({ ...baseInsert, source: scenario ? "roleplay" : "conversar" })
    .select("id")
    .single());

  if (insertError) {
    console.error("[quiz] insert error (with source):", insertError.message);
    ({ data: saved, error: insertError } = await supabase
      .from("quiz_results")
      .insert(baseInsert)
      .select("id")
      .single());
    if (insertError) console.error("[quiz] insert error (without source):", insertError.message);
  }

  return NextResponse.json({ quiz, sessionId: saved?.id ?? null });

  } catch (err) {
    console.error("[quiz] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId, score, answers, quiz: quizData, level } = await req.json();
  const total: number = answers?.length ?? 5;

  if (sessionId) {
    // Happy path: update existing row
    const { error: updateError } = await supabase
      .from("quiz_results")
      .update({ score, answers, completed_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("user_id", userId);

    if (updateError) {
      console.error("[quiz] update error:", updateError.message);
      // Fall through to insert as last resort
    } else {
      await grantXP(userId, { type: "quiz", score, total }).catch(() => {});
      return NextResponse.json({ ok: true });
    }
  }

  // Fallback: no sessionId (POST insert failed) or update failed — save as complete row now
  if (quizData) {
    const { error: insertError } = await supabase
      .from("quiz_results")
      .insert({
        user_id: userId,
        title: quizData.title ?? "Quiz",
        level: level || "intermediate",
        questions: quizData.questions ?? [],
        score,
        answers,
        completed_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error("[quiz] fallback insert error:", insertError.message);
      return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
    }
  }

  await grantXP(userId, { type: "quiz", score, total }).catch(() => {});
  return NextResponse.json({ ok: true });
}
