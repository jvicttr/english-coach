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

  const { data: allResults } = await supabase
    .from("quiz_results")
    .select("user_id, created_at")
    .order("created_at", { ascending: false });

  if (!allResults || allResults.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const byUser: Record<string, string[]> = {};
  for (const row of allResults) {
    if (!byUser[row.user_id]) byUser[row.user_id] = [];
    byUser[row.user_id].push(row.created_at);
  }

  const toNotify: { userId: string; streak: number }[] = [];
  for (const [userId, dates] of Object.entries(byUser)) {
    const practicedToday = dates.some((d) => d.startsWith(today));
    if (practicedToday) continue;

    const streak = calcStreak(dates);
    toNotify.push({ userId, streak });
  }

  if (toNotify.length === 0) {
    return NextResponse.json({ sent: 0, message: "All users practiced today" });
  }

  const userIds = toNotify.map((u) => u.userId);
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("user_id, email, name")
    .in("user_id", userIds);

  const subsMap: Record<string, { email: string; name: string }> = {};
  for (const s of subs ?? []) {
    if (s.email) subsMap[s.user_id] = { email: s.email, name: s.name ?? "aluno" };
  }

  let sent = 0;

  // Push via OneSignal — um único batch para todos os userIds
  const pushIds = toNotify.map((u) => u.userId);
  if (pushIds.length > 0 && process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_API_KEY) {
    const utcHour = new Date().getUTCHours();
    const pushHeading = utcHour < 14 ? "Bom dia! 🌅" : "Hora de praticar! 🎯";
    const pushBody = utcHour < 14
      ? "Não perca seu streak — pratique inglês agora antes de começar o dia!"
      : "Você ainda não praticou hoje. Mantenha sua sequência!";

    fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${process.env.ONESIGNAL_API_KEY}` },
      body: JSON.stringify({
        app_id: process.env.ONESIGNAL_APP_ID,
        include_aliases: { external_id: pushIds },
        target_channel: "push",
        headings: { en: pushHeading, pt: pushHeading },
        contents: { en: pushBody, pt: pushBody },
        url: "https://www.faleinglesjv.com/app",
        web_url: "https://www.faleinglesjv.com/app",
        chrome_web_icon: "https://www.faleinglesjv.com/favicon.png",
      }),
    }).catch((e) => console.warn("[streak-reminder] push error:", e));
  }

  for (const { userId, streak } of toNotify) {
    const sub = subsMap[userId];
    if (!sub?.email) continue;

    const firstName = sub.name.split(" ")[0];

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

  return NextResponse.json({ sent, total: toNotify.length });
}
