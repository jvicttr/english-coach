import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const formData = await req.formData();
    const audio = formData.get("audio") as File;

    if (!audio) {
      return NextResponse.json({ error: "Nenhum áudio recebido" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY não configurada" }, { status: 500 });
    }

    const transcription = await openai.audio.transcriptions.create({
      file: audio,
      model: "gpt-4o-transcribe",
      prompt: "The speaker is a Brazilian Portuguese native learning English. They speak mostly in English but sometimes say one word or short phrase in Portuguese in the middle of the sentence when they forget the English word, for example: \"I want to buy a new cadeira for my office\" or \"the comida was amazing\". Transcribe exactly what is spoken, word for word, keeping any Portuguese words written in Portuguese. Do NOT translate or replace Portuguese words with their English equivalent.",
    });

    return NextResponse.json({ transcript: transcription.text });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
