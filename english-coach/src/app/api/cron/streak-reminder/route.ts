import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, streakReminderHtml } from "@/lib/email";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

function calcStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const unique = [...new Set(dates.map((d) => d.split("T")[0]))].sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().split("T")[0];

  if (unique[0] !== yStr) return 0;

  let streak = 1;
  for (let i = 1; i < unique.length; i++) {
    const prev = new Date(unique[i - 1]);
    const curr = new Date(unique[i]);
    const diff = Math.round(
      (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];

  // All quiz results for streak calculation
  const { data: allResults } = await supabase
    .from("quiz_results")
    .select("user_id, created_at")
    .order("created_at", { ascending: false });

  const byUser: Record<string, string[]> = {};
  for (const row of allResults ?? []) {
    if (!byUser[row.user_id]) byUser[row.user_id] = [];
    byUser[row.user_id].push(row.created_at);
  }

  const practicedToday = new Set(
    Object.entries(byUser)
      .filter(([, dates]) => dates.some((d) => d.startsWith(today)))
      .map(([id]) => id)
  );

  // All users with email (including new users who never practiced)
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("user_id, email, name")
    .not("email", "is", null);

  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  let sent = 0;

  for (const sub of subs) {
    if (!sub.email || practicedToday.has(sub.user_id)) continue;

    const firstName = (sub.name ?? "aluno").split(" ")[0];
    const streak = calcStreak(byUser[sub.user_id] ?? []);

    await sendEmail({
      to: sub.email,
      subject:
        streak >= 3
          ? `🔥 ${streak} dias seguidos — não para agora, ${firstName}!`
          : `💬 Hora de praticar inglês agora, ${firstName}!`,
      html: streakReminderHtml(firstName, streak),
    });

    sent++;
  }

  return NextResponse.json({ sent, total: subs.length });
}
