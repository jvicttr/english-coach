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

const QUIZ_PROMPT = `You are an English teacher creating a short review quiz based on a real conversation a student just had.

Analyze the conversation and create exactly 5 multiple-choice questions that review:
- Grammar structures the student used (correctly or incorrectly)
- Vocabulary that appeared in the conversation
- Phrases or expressions from the conversation

Rules:
- Each question must be directly related to something from THIS conversation
- 4 options each (A, B, C, D), only one correct
- Questions in Portuguese, options in English
- Difficulty should match the student's level
- Focus on the most useful/common structures

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

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
  const { messages, level, scenario } = await req.json();

  const conversationText = messages
    .map((m: { role: string; content: string }) => `${m.role === "user" ? "Student" : "Coach"}: ${m.content}`)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1200,
    system: QUIZ_PROMPT,
    messages: [
      {
        role: "user",
        content: `Student level: ${level || "intermediate"}${scenario ? `\nScenario: ${scenario}` : ""}\n\nConversation:\n${conversationText}`,
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
  const { data: saved, error: insertError } = await supabase
    .from("quiz_results")
    .insert({
      user_id: userId,
      title: quiz.title,
      level: level || "intermediate",
      questions: quiz.questions,
      score: null,
      completed_at: null,
      source: scenario ? "roleplay" : "conversar",
    })
    .select("id")
    .single();

  if (insertError) console.error("[quiz] insert error:", insertError.message);

  return NextResponse.json({ quiz, sessionId: saved?.id ?? null });

  } catch (err) {
    console.error("[quiz] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId, score, answers } = await req.json();

  const { error: updateError } = await supabase
    .from("quiz_results")
    .update({ score, answers, completed_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", userId);

  if (updateError) console.error("[quiz] update error:", updateError.message);

  const total: number = answers?.length ?? 5;
  grantXP(userId, { type: "quiz", score, total }).catch(() => {});

  return NextResponse.json({ ok: true });
}
