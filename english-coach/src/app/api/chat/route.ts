import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { grantXP } from "@/lib/xp";
import { SYSTEM_PROMPT } from "@/lib/prompts/system";
import { TOPIC_CONTEXTS, FREE_CONVERSATION_CONTEXT } from "@/lib/prompts/topics";
import { ROLEPLAY_SCENARIOS, buildRoleplayBlock } from "@/lib/prompts/roleplay";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

const FREE_LIMIT = 5;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan, level")
    .eq("user_id", userId)
    .single();

  const isPro = sub?.plan === "pro";
  const savedLevel = sub?.level ?? null;

  const today = new Date().toISOString().split("T")[0];

  if (!isPro) {
    const { data: row } = await supabase
      .from("usage")
      .select("count")
      .eq("user_id", userId)
      .eq("date", today)
      .single();

    const currentCount = row?.count ?? 0;

    if (currentCount >= FREE_LIMIT) {
      return NextResponse.json({ limitReached: true }, { status: 200 });
    }

    await supabase.from("usage").upsert(
      { user_id: userId, date: today, count: currentCount + 1 },
      { onConflict: "user_id,date" }
    );
  } else {
    void Promise.resolve(supabase.from("usage").upsert(
      { user_id: userId, date: today, count: 1 },
      { onConflict: "user_id,date" }
    )).catch(() => {});
  }

  const { messages, level, topic, topicStart, roleplay, scenario, stepContext } = await req.json();

  if (roleplay && !isPro) {
    return NextResponse.json({ proRequired: true }, { status: 403 });
  }

  const effectiveLevel = level || savedLevel || "intermediate";
  let systemFull = `${SYSTEM_PROMPT}\n\nStudent level: ${effectiveLevel} (this is their saved profile level — trust it from the start, do not re-detect from scratch)`;

  if (roleplay && scenario && ROLEPLAY_SCENARIOS[scenario]) {
    systemFull += buildRoleplayBlock(ROLEPLAY_SCENARIOS[scenario], scenario, effectiveLevel, !!topicStart);
  } else if (topic === "free" || !topic) {
    if (stepContext) {
      systemFull += `\n\nLEARNING PATH STEP — Guided conversation.
The student is working through a structured learning trail. This session has a specific focus:
${stepContext}

Guide the conversation around this theme. Keep it natural and engaging, not like a drill. After 6-8 exchanges, wrap up naturally. The student needs to score ≥70% on the quiz to complete this step.`;
    } else {
      systemFull += `\n\n${FREE_CONVERSATION_CONTEXT}`;
    }
  } else if (topic && TOPIC_CONTEXTS[topic]) {
    systemFull += `\n\n${TOPIC_CONTEXTS[topic]}`;
    if (topicStart) {
      systemFull += getTopicStartHint(topic);
    }
  }

  const baseMessages = topicStart
    ? [{ role: "user" as const, content: "start the session" }]
    : messages.slice(-20).map(({ role, content }: { role: string; content: string }) => ({ role, content }));

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 900,
    system: systemFull,
    messages: baseMessages,
  });

  const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";
  const rawNoBR = raw.replace(/\[BR:([^\]]+)\]/g, "$1");
  const levelMatch = rawNoBR.match(/\[LEVEL:(beginner|intermediate|advanced)\]/);
  const detectedLevel = levelMatch?.[1] ?? null;
  const translationMatch = rawNoBR.match(/\[PT:\s*([\s\S]*?)(?:\]|\[LEVEL:|$)/);
  const translation = translationMatch?.[1]?.trim() ?? null;

  const fixRegex = /\[FIX\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^\]]+)\]/g;
  const corrections: { wrong: string; right: string; phonetic: string; wrongSentence: string; rightSentence: string }[] = [];
  let fixMatch;
  while ((fixMatch = fixRegex.exec(rawNoBR)) !== null) {
    corrections.push({
      wrong: fixMatch[1].trim(),
      right: fixMatch[2].trim(),
      phonetic: fixMatch[3].trim(),
      wrongSentence: fixMatch[4].trim(),
      rightSentence: fixMatch[5].trim(),
    });
  }

  const reply = rawNoBR
    .replace(/\[LEVEL:(beginner|intermediate|advanced)\]/, "")
    .replace(/\[PT:[\s\S]*?\]/, "")
    .replace(/\[FIX\|(?:[^|]*\|){4}[^\]]*\]/g, "")
    .trim();

  let finalTranslation = translation;
  if (!finalTranslation && reply) {
    try {
      const fallback = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{ role: "user", content: `Translate this English text to Brazilian Portuguese (pt-BR). Reply with ONLY the translation, no extra text:\n\n${reply}` }],
      });
      const fbText = fallback.content[0].type === "text" ? fallback.content[0].text.trim() : null;
      if (fbText) finalTranslation = fbText;
    } catch { /* ignore */ }
  }

  if (detectedLevel && detectedLevel !== savedLevel) {
    void Promise.resolve(
      supabase.from("subscriptions").upsert({ user_id: userId, level: detectedLevel }, { onConflict: "user_id" })
    ).catch(() => {});
  }

  if (!topicStart) {
    await grantXP(userId, { type: "message", detectedLevel: detectedLevel ?? undefined }).catch(() => {});
  }

  return NextResponse.json({ reply, detectedLevel, translation: finalTranslation, corrections });
}

function getTopicStartHint(topic: string): string {
  const hints: Record<string, string> = {
    work: "\nOpen the session by asking what the student does for work (or where they'd like to work) in a natural, friendly way. Keep it casual — not like an interview.",
    travel: "\nOpen by asking if the student has a trip coming up, or the last place they travelled to. Be excited and curious.",
    movies: "\nOpen by asking what they've been watching lately — series, movies, anything. Be casual like a friend.",
    phrasal: "\nOpen by using 2-3 phrasal verbs naturally in your first message. Ask about something in their life — weekend, plans, work — using phrasal verbs throughout.",
    food: "\nOpen by asking what the student's favorite food is, or if they've tried any new dish or restaurant recently. Be enthusiastic.",
    tech: "\nOpen by asking what apps or tech tools the student uses most in their daily life, or if there's any new tech they're excited about.",
    daily: "\nOpen by asking about the student's day so far, or what they've been up to this week. Super casual, like bumping into a friend.",
  };
  return hints[topic] ?? "";
}
