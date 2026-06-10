import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date().toISOString().split("T")[0];

  const { data: cards } = await supabase
    .from("flashcards")
    .select("*")
    .eq("user_id", userId)
    .lte("next_review", today)
    .order("next_review", { ascending: true })
    .limit(20);

  const { count } = await supabase
    .from("flashcards")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .lte("next_review", today);

  return NextResponse.json({ cards: cards ?? [], pending: count ?? 0 });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cards } = await req.json();
  if (!cards?.length) return NextResponse.json({ ok: true });

  const rows = cards.map((c: { word: string; translation: string; phonetic?: string; example?: string; topic?: string }) => ({
    user_id: userId,
    word: c.word,
    translation: c.translation,
    phonetic: c.phonetic ?? null,
    example: c.example ?? null,
    topic: c.topic ?? null,
    interval: 1,
    ease_factor: 2.5,
    next_review: new Date().toISOString().split("T")[0],
  }));

  await supabase.from("flashcards").upsert(rows, { onConflict: "user_id,word", ignoreDuplicates: true });

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, rating } = await req.json(); // rating: "easy" | "hard" | "miss"

  const { data: card } = await supabase
    .from("flashcards")
    .select("interval, ease_factor")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let { interval, ease_factor } = card;

  if (rating === "miss") {
    interval = 1;
  } else if (rating === "hard") {
    interval = Math.max(1, Math.round(interval * 1.2));
    ease_factor = Math.max(1.3, ease_factor - 0.15);
  } else {
    interval = Math.round(interval * ease_factor);
    ease_factor = Math.min(3.0, ease_factor + 0.1);
  }

  const next_review = new Date(Date.now() + interval * 86400000).toISOString().split("T")[0];
  await supabase.from("flashcards").update({ interval, ease_factor, next_review }).eq("id", id);

  return NextResponse.json({ ok: true, next_review });
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  await supabase.from("flashcards").delete().eq("id", id).eq("user_id", userId);

  return NextResponse.json({ ok: true });
}
