export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { text, direction } = await req.json(); // direction: "pt-en" | "en-pt"
  if (!text?.trim()) return NextResponse.json({ error: "No text" }, { status: 400 });

  const isPtToEn = direction !== "en-pt";

  const prompt = isPtToEn
    ? `You are an English teacher helping a Brazilian student. Translate the following Portuguese text to English and provide learning details.

Text: "${text.slice(0, 300)}"

Respond in this exact JSON format (no markdown, no explanation outside JSON):
{
  "translation": "the English translation",
  "phonetic": "IPA phonetic pronunciation for the main word/phrase (only if it's a word or short phrase, otherwise null)",
  "type": "word | phrase | expression | phrasal_verb | sentence",
  "example": "a natural English example sentence using this translation (only for word/phrase/expression/phrasal_verb, otherwise null)",
  "example_pt": "Portuguese translation of that example sentence (null if example is null)",
  "note": "brief note about usage, register, or common mistakes — in Portuguese (null if not needed)"
}`
    : `You are an English teacher helping a Brazilian student. Translate the following English text to Brazilian Portuguese and provide learning details.

Text: "${text.slice(0, 300)}"

Respond in this exact JSON format (no markdown, no explanation outside JSON):
{
  "translation": "a tradução em português brasileiro",
  "phonetic": "IPA phonetic pronunciation of the English text (only if it's a word or short phrase, otherwise null)",
  "type": "word | phrase | expression | phrasal_verb | sentence",
  "example": "a natural English example sentence (only for word/phrase/expression/phrasal_verb, otherwise null)",
  "example_pt": "Portuguese translation of that example (null if example is null)",
  "note": "brief note about usage, register, or common mistakes — in Portuguese (null if not needed)"
}`;

  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (res.content[0] as { text: string }).text.trim()
    .replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  try {
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch {
    // Fallback: just return raw as translation
    return NextResponse.json({ translation: raw, phonetic: null, type: "sentence", example: null, example_pt: null, note: null });
  }
}
