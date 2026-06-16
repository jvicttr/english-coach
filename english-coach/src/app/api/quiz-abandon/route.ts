import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const { sessionId, score, answers } = await req.json();
    if (!sessionId || score == null) return NextResponse.json({ ok: false });

    await supabase
      .from("quiz_results")
      .update({ score, answers, completed_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("user_id", userId)
      .is("completed_at", null); // only update if not already completed

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
