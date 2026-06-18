import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export const dynamic = "force-dynamic";

// GET — list all reviews for the user
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("lesson_reviews")
    .select("id, file_name, message_count, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ reviews: data ?? [] });
}

// POST — create or update a review session
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, file_name, lesson_context, messages } = await req.json();

  const row = {
    user_id: userId,
    file_name: file_name ?? null,
    lesson_context: lesson_context ?? null,
    messages: messages ?? [],
    message_count: (messages ?? []).length,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    // Update existing session
    const { data, error } = await supabase
      .from("lesson_reviews")
      .update(row)
      .eq("id", id)
      .eq("user_id", userId)
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ id: data.id });
  } else {
    // Create new session
    const { data, error } = await supabase
      .from("lesson_reviews")
      .insert({ ...row, created_at: new Date().toISOString() })
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ id: data.id });
  }
}

// DELETE — remove a review
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await supabase.from("lesson_reviews").delete().eq("id", id).eq("user_id", userId);
  return NextResponse.json({ ok: true });
}
