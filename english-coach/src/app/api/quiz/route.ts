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
- Questions should test recognition, but the student must still recall or reason out the word — never display it
- Options must use only high-frequency everyday words — no idioms, no phrasal verbs
- Wrong options should be plausible but clearly different (avoid trick questions)
- Keep questions short and direct — no complex grammar in the question itself
- Translation questions are fine ("Como se diz 'escola' em inglês?") as long as the English target word never appears anywhere in the Portuguese stem
- Gap-fill questions must NOT include the base/infinitive form of the target verb in parentheses or nearby text (e.g. never "I ___ (go) to school yesterday") — the student must know the verb from the conversation, not read it off the question`,

  elementary: `The student is ELEMENTARY/BASIC (a step above beginner). Quiz rules for this level:
- Focus on basic vocabulary plus simple past/future tense, still no idioms or phrasal verbs
- Options must use common everyday words, slightly less basic than pure beginner but still very accessible
- Wrong options should be plausible but clearly different (avoid trick questions)
- Keep questions short and direct — no complex grammar in the question itself
- Gap-fill questions must NOT include the base/infinitive form of the target verb in parentheses or nearby text`,

  intermediate: `The student is INTERMEDIATE. Quiz rules for this level:
- Mix grammar questions (tense choice, prepositions, articles) with vocabulary and phrases
- Include 1-2 phrasal verb or common expression questions from the conversation
- Wrong options should be plausibly confusing (e.g. "go" vs "went" vs "gone" vs "going") — all 4 options must be grammatically plausible in isolation, so only conversation context/meaning decides the answer
- Questions can test understanding of context ("In this sentence, 'get along' means...?") but must NOT quote a definition or synonym of the correct option inside the stem
- Avoid trivial single-word questions — prefer phrases and expressions
- Difficulty: challenging but achievable for someone who communicates clearly despite some errors`,

  advanced: `The student is ADVANCED. Quiz rules for this level:
- Focus on nuance, idioms, collocations, and sophisticated vocabulary
- Test subtle grammar (conditionals, perfect aspects, passive voice usage, modal nuances)
- Wrong options must be near-synonyms or plausible near-correct forms (no obvious distractors) — a native speaker should need to actually think before answering
- Include at least 2 questions about idiomatic expressions or register (formal vs casual)
- Can test word choice precision: "Which word fits best here and why?" — but never define or paraphrase the correct word inside the question itself
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
- CRITICAL — no answer leakage: before finalizing each question, check that the correct option (or its meaning, translation, root word, or an obvious inflection of it) does NOT appear anywhere in the question stem. If the student could point to the right answer just by matching words between the question and an option, without knowing any English, rewrite the question. The question must require actual knowledge from the conversation to answer, not pattern-matching against the stem.
- CRITICAL — never quote the original sentence: do NOT quote (in English, between quotation marks or not) the exact sentence the student or coach said in the conversation when that sentence already contains the correct answer or its translation. E.g. if the student said "I don't like France", do NOT write a question like 'Na conversa, o estudante disse "I don't like France." Como se diz "eu não gosto" em inglês?' — that hands over the answer. Instead, describe the topic/situation in your own words without repeating the target phrase (e.g. "Na conversa, você falou sobre não gostar de um país. Como se diz 'eu não gosto' em inglês?")
- Do not make the correct option the only one that "sounds right" grammatically if the others are nonsense — all 4 options should be real, plausible English so the student has to know the material, not just spot the only valid-looking answer
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

type QuizQuestion = { question: string; options: string[]; correct: number; explanation: string };
type QuizPayload = { title: string; questions: QuizQuestion[] };

const RETRY_WARNING = `IMPORTANT: your previous attempt leaked the answer — either by repeating the correct option's words in the question stem, or by quoting the exact sentence from the conversation that already contains the correct answer. Rewrite ALL 5 questions from scratch. Paraphrase situations in your own words instead of quoting the original sentence, and double-check that none of the 4 options' text appears inside its own question stem.`;

function normalizeForLeakCheck(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function quizLeaksAnswers(quiz: QuizPayload): boolean {
  return quiz.questions.some((q) => {
    const stem = normalizeForLeakCheck(q.question ?? "");
    const correctOpt = normalizeForLeakCheck(q.options?.[q.correct] ?? "");
    if (correctOpt.length < 3) return false;
    return stem.includes(correctOpt);
  });
}

async function generateQuiz(resolvedLevel: string, scenario: string | undefined, conversationText: string, extraWarning?: string): Promise<QuizPayload> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: buildQuizPrompt(resolvedLevel) + (extraWarning ? `\n\n${extraWarning}` : ""),
    messages: [
      {
        role: "user",
        content: `Student level: ${resolvedLevel}${scenario ? `\nScenario: ${scenario}` : ""}\n\nConversation:\n${conversationText}`,
      },
    ],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";
  // Strip markdown code blocks if model wrapped the JSON
  let cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  // Guard against stray text before/after the JSON object
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) cleaned = cleaned.slice(start, end + 1);
  return JSON.parse(cleaned) as QuizPayload;
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

  let quiz: QuizPayload;
  try {
    quiz = await generateQuiz(resolvedLevel, scenario, conversationText);
    if (quizLeaksAnswers(quiz)) {
      console.warn("[quiz] answer leak detected, regenerating with stronger warning");
      const retried = await generateQuiz(resolvedLevel, scenario, conversationText, RETRY_WARNING);
      if (!quizLeaksAnswers(retried)) quiz = retried;
      else console.warn("[quiz] retry still leaked, serving anyway");
    }
  } catch (parseErr) {
    console.error("[quiz] parse error, retrying once:", parseErr);
    try {
      quiz = await generateQuiz(resolvedLevel, scenario, conversationText);
    } catch (retryErr) {
      console.error("[quiz] retry parse error:", retryErr);
      return NextResponse.json({ error: "Failed to parse quiz" }, { status: 500 });
    }
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
      const { newBadges } = await grantXP(userId, { type: "quiz", score, total }).catch(() => ({ newXp: 0, newBadges: [] }));
      return NextResponse.json({ ok: true, newBadges });
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

  const { newBadges } = await grantXP(userId, { type: "quiz", score, total }).catch(() => ({ newXp: 0, newBadges: [] }));
  return NextResponse.json({ ok: true, newBadges });
}
