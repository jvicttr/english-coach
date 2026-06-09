import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, streakReminderHtml } from "@/lib/email";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

async function notifyWhatsApp(message: string) {
  const apiKey = process.env.CALLMEBOT_API_KEY;
  if (!apiKey) return;
  const phone = "5561995691219";
  try {
    await fetch(
      `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(message)}&apikey=${apiKey}`
    );
  } catch (e) {
    console.error("[whatsapp]", e);
  }
}

// Calculates streak for a single user's quiz dates (ISO date strings)
function calcStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const unique = [...new Set(dates.map((d) => d.split("T")[0]))].sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  // Streak only counts if they practiced yesterday (not today — cron runs at 19h)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().split("T")[0];

  if (unique[0] !== yStr) return 0; // practiced yesterday → at risk today

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
  // Security: only Vercel Cron or requests with the right secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];

  // Get all users who have practiced at some point
  const { data: allResults } = await supabase
    .from("quiz_results")
    .select("user_id, created_at")
    .order("created_at", { ascending: false });

  if (!allResults || allResults.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  // Group by user_id
  const byUser: Record<string, string[]> = {};
  for (const row of allResults) {
    if (!byUser[row.user_id]) byUser[row.user_id] = [];
    byUser[row.user_id].push(row.created_at);
  }

  // Find users who practiced yesterday but NOT today (streak at risk)
  const atRisk: { userId: string; streak: number }[] = [];
  for (const [userId, dates] of Object.entries(byUser)) {
    const practicedToday = dates.some((d) => d.startsWith(today));
    if (practicedToday) continue; // already practiced today, skip

    const streak = calcStreak(dates);
    if (streak > 0) {
      atRisk.push({ userId, streak });
    }
  }

  if (atRisk.length === 0) {
    return NextResponse.json({ sent: 0, message: "No users at risk today" });
  }

  // Fetch emails/names from subscriptions table
  const userIds = atRisk.map((u) => u.userId);
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("user_id, email, name")
    .in("user_id", userIds);

  const subsMap: Record<string, { email: string; name: string }> = {};
  for (const s of subs ?? []) {
    if (s.email) subsMap[s.user_id] = { email: s.email, name: s.name ?? "aluno" };
  }

  let sent = 0;
  const summaryLines: string[] = [];

  for (const { userId, streak } of atRisk) {
    const sub = subsMap[userId];
    if (!sub?.email) continue;

    const firstName = sub.name.split(" ")[0];

    await sendEmail({
      to: sub.email,
      subject:
        streak >= 3
          ? `🔥 ${streak} dias seguidos — não para agora, ${firstName}!`
          : `💬 Hora de praticar inglês hoje, ${firstName}!`,
      html: streakReminderHtml(firstName, streak),
    });

    sent++;
    summaryLines.push(`• ${sub.name} (${streak}d streak)`);
  }

  // WhatsApp summary for JV
  if (sent > 0) {
    const msg =
      `📊 Lembrete de streak enviado para ${sent} aluno${sent > 1 ? "s" : ""}:\n` +
      summaryLines.join("\n");
    await notifyWhatsApp(msg);
  }

  return NextResponse.json({ sent, atRisk: atRisk.length });
}
