import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [{ data: review, error }, { data: quizzes }, { data: fcRows }] = await Promise.all([
    supabase.from("lesson_reviews").select("*").eq("id", id).eq("user_id", userId).single(),
    supabase.from("quiz_results").select("id, title, score, questions, completed_at, created_at").eq("lesson_review_id", id).eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("flashcards").select("pack_id, pack_name").eq("lesson_review_id", id).eq("user_id", userId),
  ]);

  if (error || !review) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Deduplicate flashcard packs
  const packMap = new Map<string, string>();
  (fcRows ?? []).forEach((r: { pack_id: string; pack_name: string }) => packMap.set(r.pack_id, r.pack_name));
  const packs = Array.from(packMap.entries()).map(([id, name]) => ({ id, name }));

  return NextResponse.json({ review, quizzes: quizzes ?? [], flashcardPacks: packs });
}
