import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { TRAIL_STEPS } from "@/lib/trilha-steps";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ completed: [] });

  const { data } = await supabase
    .from("learning_path_progress")
    .select("step_id, score, total, completed_at")
    .eq("user_id", userId);

  return NextResponse.json({ completed: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { stepId, score, total } = await req.json();

  const validStep = TRAIL_STEPS.find((s) => s.id === stepId);
  if (!validStep) return NextResponse.json({ error: "Invalid step" }, { status: 400 });

  await supabase
    .from("learning_path_progress")
    .upsert(
      { user_id: userId, step_id: stepId, score, total, completed_at: new Date().toISOString() },
      { onConflict: "user_id,step_id" }
    );

  return NextResponse.json({ ok: true });
}
