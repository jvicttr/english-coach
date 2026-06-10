import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { messages, topic } = await req.json();
  if (!messages?.length) return NextResponse.json({ cards: [] });

  const conversation = messages
    .slice(-20)
    .map((m: { role: string; content: string }) => `${m.role === "user" ? "Student" : "Coach"}: ${m.content}`)
    .join("\n");

  const prompt = `Analyze this English conversation and extract exactly 5 vocabulary words or expressions the student should review.

Conversation:
${conversation}

Rules:
- Pick words/expressions the student used incorrectly OR interesting vocabulary from the coach's replies
- Prefer phrases over single common words when possible (e.g. "get along with" > "good")
- Skip very basic words (go, eat, like, good)

Return ONLY valid JSON, no markdown:
{
  "cards": [
    {
      "word": "the English word or phrase",
      "translation": "tradução em português brasileiro",
      "phonetic": "pronúncia informal adaptada ao português (ex: píkl)",
      "example": "a short example sentence using the word"
    }
  ]
}`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "{}";

  let cards: { word: string; translation: string; phonetic?: string; example?: string }[] = [];
  try {
    const parsed = JSON.parse(raw);
    cards = parsed.cards ?? [];
  } catch {
    return NextResponse.json({ cards: [] });
  }

  if (cards.length > 0) {
    const rows = cards.map((c) => ({
      user_id: userId,
      word: c.word,
      translation: c.translation,
      phonetic: c.phonetic ?? null,
      example: c.example ?? null,
      topic: topic ?? null,
      interval: 1,
      ease_factor: 2.5,
      next_review: new Date().toISOString().split("T")[0],
    }));

    await supabase.from("flashcards").upsert(rows, { onConflict: "user_id,word", ignoreDuplicates: true });
  }

  return NextResponse.json({ cards });
}
