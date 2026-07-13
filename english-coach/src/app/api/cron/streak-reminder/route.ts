import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, streakReminderHtml } from "@/lib/email";
import { sendPushMulticast } from "@/lib/fcm";
import { pushToUser } from "@/lib/push";

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

  const force = req.nextUrl.searchParams.get("force") === "true";
  const today = new Date().toISOString().split("T")[0];

  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const sinceDate = sixtyDaysAgo.toISOString().split("T")[0];
  const sinceIso = sixtyDaysAgo.toISOString();

  // "Praticou hoje" conta qualquer atividade no app (chat IA, quiz, post na
  // comunidade) — mesma definição usada em /api/home para o streak exibido
  // ao usuário. Antes só olhava quiz_results, então quem só conversou no dia
  // (sem terminar com quiz) recebia o lembrete por engano.
  const [{ data: usageRows }, { data: quizRows }, { data: communityRows }] = await Promise.all([
    supabase.from("usage").select("user_id, date").gte("date", sinceDate),
    supabase.from("quiz_results").select("user_id, created_at").not("score", "is", null).gte("created_at", sinceIso),
    supabase.from("community_posts").select("user_id, created_at").gte("created_at", sinceIso),
  ]);

  if ((!usageRows || usageRows.length === 0) && (!quizRows || quizRows.length === 0) && (!communityRows || communityRows.length === 0)) {
    return NextResponse.json({ sent: 0 });
  }

  const byUser: Record<string, string[]> = {};
  const addDate = (userId: string, dateStr: string) => {
    if (!byUser[userId]) byUser[userId] = [];
    byUser[userId].push(dateStr);
  };
  for (const row of usageRows ?? []) addDate(row.user_id, row.date);
  for (const row of quizRows ?? []) addDate(row.user_id, row.created_at);
  for (const row of communityRows ?? []) addDate(row.user_id, row.created_at);

  const toNotify: { userId: string; streak: number }[] = [];
  for (const [userId, dates] of Object.entries(byUser)) {
    const practicedToday = dates.some((d) => d.startsWith(today));
    if (practicedToday && !force) continue;

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
  let pushOk = 0, pushFail = 0, pushNoSub = 0;
  const pushErrors: string[] = [];

  // Push para usuários que não praticaram hoje (FCM multicast + Web Push individual)
  if (toNotify.length > 0) {
    const utcHour = new Date().getUTCHours();
    const pushTitle = utcHour < 14 ? "Bom dia! 🌅" : "Hora de praticar! 🎯";
    const pushBody = utcHour < 14
      ? "Não perca seu streak — pratique inglês agora antes de começar o dia!"
      : "Você ainda não praticou hoje. Mantenha sua sequência!";

    // FCM multicast (Android/desktop)
    const { data: tokenRows } = await supabase
      .from("subscriptions")
      .select("fcm_token")
      .in("user_id", userIds)
      .not("fcm_token", "is", null);
    const tokens = (tokenRows ?? []).map((r) => r.fcm_token).filter(Boolean) as string[];
    if (tokens.length > 0) {
      sendPushMulticast(tokens, pushTitle, pushBody, "https://www.faleinglesjv.com/app").catch(() => {});
    }

    // Web Push individual
    for (const { userId } of toNotify) {
      try {
        const result = await pushToUser(userId, pushTitle, pushBody, "https://www.faleinglesjv.com/app");
        if (result === "sent") pushOk++;
        else if (result === "no_subscription") pushNoSub++;
        else pushFail++;
      } catch (e: any) {
        pushFail++;
        pushErrors.push(e?.message ?? String(e));
      }
    }
    console.log("push results", { pushOk, pushFail, pushNoSub, pushErrors });
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

  return NextResponse.json({ sent, total: toNotify.length, pushOk, pushFail, pushNoSub });
}
