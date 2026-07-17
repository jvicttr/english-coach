import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { fetchNewsHeadlines } from "@/lib/news";
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

  const { messages, level, topic, topicStart, roleplay, scenario, stepContext, stepLevel } = await req.json();

  if (roleplay && !isPro) {
    return NextResponse.json({ proRequired: true }, { status: 403 });
  }

  // Always use the profile-saved level — never let the AI's per-message detection override the user's explicit choice
  const effectiveLevel = savedLevel || "intermediate";

  const levelInstructions: Record<string, string> = {
    beginner: "BEGINNER level — Use extremely short, simple sentences. Present tense only. Survival vocabulary (the 300 most common English words). No idioms, no phrasal verbs, no compound sentences. Speak slowly and clearly, like talking to someone on their very first week of English. If the student writes more than you expect, do NOT upgrade their level — they chose beginner. LENGTH: 1 short sentence (max ~8 words), a second only if truly necessary. Straight to the point, one simple direct question — never a long or elaborate reply.",
    elementary: "ELEMENTARY/BASIC level — Use short, simple sentences with common everyday vocabulary. Mostly present tense, with very basic past tense for familiar routines. Almost no idioms or phrasal verbs — introduce at most one very common one occasionally. A step above beginner: the student can follow slightly longer sentences but still needs simple, direct language. LENGTH: 1-2 short sentences max. Keep it plain and easy to follow.",
    intermediate: "INTERMEDIATE level — Use past and future tenses naturally. Introduce phrasal verbs and common expressions. Medium-length sentences. Do NOT simplify to beginner just because a message is short, and do NOT upgrade to advanced just because a message is fluent. LENGTH: 2 sentences max. Natural but tight — no rambling, no extra explanations tacked on.",
    advanced: "ADVANCED level — Use rich vocabulary, idioms, varied tenses, conditionals, passive voice, nuance, humor. Never simplify your language. Treat them as near-native. Even if a message is short or has errors, keep your advanced-level output — the student has explicitly chosen this level. LENGTH: up to 3 sentences max. Rich language is fine, but stay conversational and punchy — never write a paragraph.",
  };

  let systemFull = `${SYSTEM_PROMPT}\n\n## LOCKED STUDENT LEVEL: ${effectiveLevel.toUpperCase()}\n${levelInstructions[effectiveLevel] ?? levelInstructions.intermediate}\nThis level is set by the student's profile and CANNOT change mid-conversation. The [LEVEL:xxx] token you output is for logging only — it does NOT affect your vocabulary or complexity for this session.`;

  if (roleplay && scenario && ROLEPLAY_SCENARIOS[scenario]) {
    systemFull += buildRoleplayBlock(ROLEPLAY_SCENARIOS[scenario], scenario, effectiveLevel, !!topicStart);
  } else if (topic === "free" || !topic) {
    if (stepContext) {
      const cefrDesc = stepLevel ? CEFR_DESCRIPTIONS[stepLevel as keyof typeof CEFR_DESCRIPTIONS] : null;
      systemFull += `\n\nLEARNING PATH STEP — Guided conversation.
The student is working through a structured learning trail. This session has a specific focus:
${stepContext}
${cefrDesc ? `\nTarget CEFR level for this step: ${stepLevel} — ${cefrDesc}. Pitch your language, vocabulary, and grammar complexity exactly at this level from the very first message. Do not simplify below it.` : ""}
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

  // Extract all mistakes already corrected in this session from the FIX tags in history
  if (!topicStart) {
    const fixRegexHistory = /\[FIX\|([^|]+)\|([^|]+)\|[^|]*\|([^|]*)\|[^\]]*\]/g;
    const alreadyCorrected: string[] = [];
    for (const msg of messages) {
      if (msg.role !== "assistant") continue;
      let m;
      while ((m = fixRegexHistory.exec(msg.content)) !== null) {
        const wrong = m[1].trim();
        const right = m[2].trim();
        const wrongSentence = m[3].trim();
        alreadyCorrected.push(wrongSentence ? `"${wrongSentence}" → corrected to use "${right}"` : `"${wrong}" → corrected to "${right}"`);
      }
    }
    if (alreadyCorrected.length > 0) {
      systemFull += `\n\n## Already corrected in this session — DO NOT repeat these\n${alreadyCorrected.map(s => `- ${s}`).join("\n")}\nNever generate a [FIX] tag for any of these items again, even if the student repeats the same mistake.`;
    }
  }

  const lastUserMsg = typeof (baseMessages.filter((m: { role: string; content: string }) => m.role === "user").at(-1)?.content) === "string"
    ? (baseMessages.filter((m: { role: string; content: string }) => m.role === "user").at(-1)?.content as string)
    : "";

  // Always inject today's news headlines — cached for 30min so no latency hit
  try {
    const headlines = await fetchNewsHeadlines();
    if (headlines) {
      systemFull += `\n\n## NEWS CONTEXT (last 30 days, grouped by date)\nUse this information naturally as general knowledge. NEVER mention "headlines", "news feed", "real-time data", "my training cutoff", or any source. Speak as if you naturally know what's been happening in the world recently. If the student asks about an event and you can infer its date from context, use the dated sections below. If a specific detail isn't listed, engage naturally without revealing any limitation.\n${headlines}`;
    }
  } catch { /* news is optional — ignore errors */ }

  // Real-time web search — the model decides on its own when a question needs a
  // verified, specific current fact. Server-side tool: Anthropic runs the search
  // and folds the results into this same response, no extra round trip needed.
  // Skipped on topicStart since there's no student question yet to search for.
  const enableSearch = !topicStart;
  if (enableSearch) {
    systemFull += `\n\n## Real-time web search\nYou have a web_search tool. Use it ONLY when the student asks about something that needs a specific, verifiable, up-to-date fact you can't be fully sure of — exact dates, whether an event already happened, schedules, recent releases, scores, or the current status of something ("when is X happening", "did Y already release", "is Z still going on"). Do NOT use it for casual chat, opinions, hypotheticals, or anything already covered by the NEWS CONTEXT above. When you do search, weave the answer naturally into the conversation — never say "I searched", "according to the internet/web", "let me check", and never mention the tool, sources, or URLs.`;
  }

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 700,
    system: systemFull,
    messages: baseMessages,
    ...(enableSearch ? { tools: [{ type: "web_search_20250305" as const, name: "web_search" as const, max_uses: 3 }] } : {}),
  });

  const raw = response.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
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
        max_tokens: 1000,
        messages: [{ role: "user", content: `Translate this English text to Brazilian Portuguese (pt-BR). Translate EVERYTHING — every sentence, including any pitch, summary, or example. Reply with ONLY the translation, no extra text:\n\n${reply}` }],
      });
      const fbText = fallback.content[0].type === "text" ? fallback.content[0].text.trim() : null;
      if (fbText) finalTranslation = fbText;
    } catch { /* ignore */ }
  }

  // Level is never auto-updated from chat detection — only changes via learning path progression

  let newBadges: Awaited<ReturnType<typeof grantXP>>["newBadges"] = [];
  if (!topicStart) {
    newBadges = (await grantXP(userId, { type: "message", detectedLevel: detectedLevel ?? undefined }).catch(() => ({ newXp: 0, newBadges: [] }))).newBadges;
  }

  return NextResponse.json({ reply, detectedLevel, translation: finalTranslation, corrections, newBadges });
}

const CEFR_DESCRIPTIONS = {
  A1: "Absolute beginner. Use very short, simple sentences. Present tense only. Survival vocabulary. Speak slowly and clearly.",
  A2: "Elementary. Simple past and future tenses. Basic daily topics. Common vocabulary only. Short sentences, no idioms.",
  B1: "Intermediate. Student can discuss familiar topics. Mix of tenses, occasional errors. Introduce natural expressions and some phrasal verbs.",
  B2: "Upper-intermediate. Complex topics, idiomatic expressions, mostly fluent. Use sophisticated vocabulary, conditionals, and nuance freely.",
  C1: "Advanced. Near-native. Complex grammar, idioms, cultural references. Push for precision, nuance, and native-like expression.",
};

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
