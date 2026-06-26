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

  const { messages, level, topic, topicStart, roleplay, scenario, stepContext, stepLevel } = await req.json();

  if (roleplay && !isPro) {
    return NextResponse.json({ proRequired: true }, { status: 403 });
  }

  const effectiveLevel = level || savedLevel || "intermediate";
  let systemFull = `${SYSTEM_PROMPT}\n\nStudent level: ${effectiveLevel} (this is their saved profile level — trust it from the start, do not re-detect from scratch)`;

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

  const webSearchTool = {
    name: "web_search",
    description: `Search the internet for real-time information. You MUST use this tool whenever the user's message references: sports games/matches/results (football, soccer, basketball, etc.), recent news or current events, scores, standings, tournament results, weather, prices, or anything time-sensitive. This includes conversational phrasing like "Did you see the game?", "What happened in the match?", "How did Brazil do?", "Who won?". Today's date is ${new Date().toISOString().split("T")[0]}. Your training data is outdated — always search for sports and current events instead of guessing.`,
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "The search query in English" },
      },
      required: ["query"],
    },
  };

  const lastUserMsg = baseMessages.filter((m: { role: string; content: string }) => m.role === "user").at(-1)?.content ?? "";
  const needsSearch = isPro && /game|match|score|result|won|win|lost|lose|played|championship|cup|tournament|news|today|yesterday|weather|price|dollar|election|season|episode|série|jogo|partida|placar|resultado|campeonato|copa|notícia|hoje|ontem|clima|preço|eleição/i.test(typeof lastUserMsg === "string" ? lastUserMsg : "");

  const createParams = isPro
    ? {
        model: "claude-sonnet-4-6",
        max_tokens: 1800,
        system: systemFull,
        messages: baseMessages,
        tools: [webSearchTool],
        tool_choice: needsSearch ? { type: "any" as const } : { type: "auto" as const },
      }
    : { model: "claude-sonnet-4-6", max_tokens: 1800, system: systemFull, messages: baseMessages };

  let response = await client.messages.create(createParams);

  // Handle tool use (Pro only — web search)
  if (isPro && response.stop_reason === "tool_use") {
    const toolUseBlock = response.content.find(b => b.type === "tool_use");
    if (toolUseBlock && toolUseBlock.type === "tool_use" && toolUseBlock.name === "web_search") {
      const query = (toolUseBlock.input as { query: string }).query;

      let searchResults = "No results found.";
      try {
        const tavilyRes = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query,
            search_depth: "basic",
            max_results: 5,
            include_answer: true,
          }),
        });
        const tavilyData = await tavilyRes.json();
        const answer = tavilyData.answer ? `Summary: ${tavilyData.answer}\n\n` : "";
        const results = (tavilyData.results ?? [])
          .map((r: { title: string; url: string; content: string }) => `- ${r.title}: ${r.content}`)
          .join("\n");
        searchResults = (answer + results).trim() || "No results found.";
      } catch { /* ignore, use fallback */ }

      const messagesWithTool = [
        ...baseMessages,
        { role: "assistant" as const, content: response.content },
        {
          role: "user" as const,
          content: [{ type: "tool_result" as const, tool_use_id: toolUseBlock.id, content: searchResults }],
        },
      ];

      // Force text response — no tools on second call to avoid infinite tool_use loop
      response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1800,
        system: systemFull,
        messages: messagesWithTool,
        tool_choice: { type: "none" },
        tools: [webSearchTool],
      });
    }
  }

  let textBlock = response.content.find(b => b.type === "text");
  // Fallback: if tool_use cycle produced no text, retry without tools
  if (!textBlock && isPro) {
    const fallbackResponse = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1800,
      system: systemFull,
      messages: baseMessages,
    });
    textBlock = fallbackResponse.content.find(b => b.type === "text");
  }
  const raw = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";
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
