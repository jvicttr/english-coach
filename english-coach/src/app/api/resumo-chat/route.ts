import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CHAT_SYSTEM = (lessonContext: string) => `You are a friendly English review coach helping a Brazilian student revisit content from their last English lesson.

## The lesson content
${lessonContext}

## Your role
- Help the student understand and practice everything from this lesson
- Answer questions about vocabulary, grammar, pronunciation, or usage covered in the material
- Give examples, analogies, and simple explanations — always adapted to a Brazilian learner
- If the student asks something not related to the lesson, gently steer back to the material
- Keep replies short: 2–4 sentences, always ending with an invitation to explore further or ask another question
- All explanations in Brazilian Portuguese, examples in English

## Language rules
- Translate or explain any English term the student asks about
- If the student writes in Portuguese, respond in Portuguese — this is a review session, not a practice session
- Use [BR:word] around Portuguese words embedded in English phrases so they get correct pronunciation
- At the end of each reply, always output on a new line:
[PT: tradução em português brasileiro da sua resposta em inglês, se houver partes em inglês]
If your full reply is already in Portuguese, output [PT: —]`;

const OPEN_PROMPT = `You are analyzing a PDF lesson material for an English student. Do two things:

1. Extract a LESSON CONTEXT: a compact but complete summary of the lesson in English, covering: main topic, grammar structures taught (with explanations), vocabulary introduced, expressions or phrasal verbs, and any pronunciation tips. This will be used as your knowledge base for the entire review session. Write it as clear prose/bullet points in English, max ~400 words.

2. Write an OPENING MESSAGE to the student in Brazilian Portuguese that:
- Greets them warmly and briefly says what you found in the lesson
- Lists the main topics covered (2–4 bullet points in Portuguese)
- Invites them to ask about anything or start practicing
- Ends naturally, like a coach excited to help them review

Return ONLY valid JSON (no markdown, no code blocks):
{
  "lessonContext": "...",
  "reply": "...",
  "translation": "..."
}
Where "translation" is the same as "reply" since it's already in Portuguese (just copy it).`;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // First call: read PDF and open the session
  if (body.topicStart && body.pdfBase64) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: body.pdfBase64 },
            },
            { type: "text", text: OPEN_PROMPT },
          ],
        },
      ],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    try {
      const parsed = JSON.parse(cleaned);
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({ error: "Failed to parse lesson" }, { status: 500 });
    }
  }

  // Subsequent messages: continue the conversation
  const { messages, lessonContext, level } = body;
  if (!lessonContext || !messages) {
    return NextResponse.json({ error: "Missing context or messages" }, { status: 400 });
  }

  const trimmed = messages.slice(-20).map(({ role, content }: { role: string; content: string }) => ({ role, content }));

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    system: CHAT_SYSTEM(lessonContext) + `\n\nStudent level: ${level || "intermediate"}`,
    messages: trimmed,
  });

  const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";
  const translationMatch = raw.match(/\[PT:\s*([\s\S]*?)(?:\]|$)/);
  const translation = translationMatch?.[1]?.trim() ?? null;
  const reply = raw.replace(/\[PT:[\s\S]*?\]/, "").replace(/\[BR:([^\]]+)\]/g, "$1").trim();

  return NextResponse.json({ reply, translation });
}
