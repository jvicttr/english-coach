export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { TRAIL_STEPS, LEVEL_INFO, TrailLevel } from "@/lib/trilha-steps";
import { grantXP } from "@/lib/xp";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ completed: [], activeSessions: [] });

  const [{ data: completed }, { data: sessions }] = await Promise.all([
    supabase.from("learning_path_progress").select("step_id, score, total, completed_at").eq("user_id", userId),
    supabase.from("trilha_sessions").select("step_id").eq("user_id", userId),
  ]);

  return NextResponse.json({
    completed: completed ?? [],
    activeSessions: (sessions ?? []).map((s) => s.step_id),
  });
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

  const { newBadges } = await grantXP(userId, { type: "trail_step", stepId }).catch(() => ({ newXp: 0, newBadges: [] }));

  // Check if user just completed all steps of a CEFR level — if so, advance their profile level
  const completedStep = TRAIL_STEPS.find((s) => s.id === stepId)!;
  const stepsInLevel = TRAIL_STEPS.filter((s) => s.level === completedStep.level);
  const { data: allCompleted } = await supabase
    .from("learning_path_progress")
    .select("step_id")
    .eq("user_id", userId)
    .in("step_id", stepsInLevel.map((s) => s.id));

  // +1 because the current step was just inserted above
  const completedCount = (allCompleted?.length ?? 0);
  if (completedCount >= stepsInLevel.length) {
    // All steps of this CEFR level done — find the next CEFR level and set user's level
    const cefrOrder: TrailLevel[] = ["A1", "A2", "B1", "B2", "C1"];
    const currentIdx = cefrOrder.indexOf(completedStep.level);
    const nextCefr = cefrOrder[currentIdx + 1] as TrailLevel | undefined;
    const newLevel = nextCefr
      ? LEVEL_INFO[nextCefr].userLevel[0]  // first userLevel of next CEFR
      : LEVEL_INFO[completedStep.level].userLevel.at(-1); // stay at highest of current if C1
    if (newLevel) {
      try {
        await supabase
          .from("subscriptions")
          .upsert({ user_id: userId, level: newLevel }, { onConflict: "user_id" });
      } catch { /* ignore */ }
    }
  }

  return NextResponse.json({ ok: true, newBadges });
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { stepId } = await req.json();
  const validStep = TRAIL_STEPS.find((s) => s.id === stepId);
  if (!validStep) return NextResponse.json({ error: "Invalid step" }, { status: 400 });

  await supabase
    .from("learning_path_progress")
    .delete()
    .eq("user_id", userId)
    .eq("step_id", stepId);

  return NextResponse.json({ ok: true });
}
