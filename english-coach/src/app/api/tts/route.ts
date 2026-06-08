import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const { text, speed, lang } = await req.json();

    if (!text?.trim()) {
      return NextResponse.json({ error: "No text" }, { status: 400 });
    }

    const isSlow = speed !== undefined && speed < 0.7;
    // "echo" for English, "nova" for Portuguese Brazilian (warmer, more BR-sounding)
    const voice = lang === "pt" ? "nova" : "echo";

    const response = await openai.audio.speech.create({
      model: isSlow ? "tts-1-hd" : "tts-1",
      voice,
      input: text,
      speed: isSlow ? 0.25 : (speed ?? 1.0),
    });

    // Stream the audio directly — client starts playing before full download
    return new NextResponse(response.body as ReadableStream, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
