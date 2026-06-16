import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

// Runs daily around 20h via Vercel Cron or external scheduler
// Sends a push notification to users with active streaks who haven't practiced today
export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ONESIGNAL_API_KEY;
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? "bd73670e-ac08-4c40-8519-2dc5bd677db7";

  if (!apiKey) {
    return NextResponse.json({ error: "ONESIGNAL_API_KEY not configured" }, { status: 500 });
  }

  const today = new Date().toISOString().split("T")[0];

  // Get users with player IDs who haven't practiced today
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("user_id, onesignal_player_id")
    .not("onesignal_player_id", "is", null);

  if (!subs?.length) return NextResponse.json({ sent: 0 });

  const userIds = subs.map((s: { user_id: string }) => s.user_id);

  // Find who practiced today
  const { data: usedToday } = await supabase
    .from("usage")
    .select("user_id")
    .in("user_id", userIds)
    .eq("date", today);

  const { data: quizzedToday } = await supabase
    .from("quiz_results")
    .select("user_id")
    .in("user_id", userIds)
    .gte("completed_at", `${today}T00:00:00`)
    .not("score", "is", null);

  const practicedToday = new Set([
    ...(usedToday ?? []).map((r: { user_id: string }) => r.user_id),
    ...(quizzedToday ?? []).map((r: { user_id: string }) => r.user_id),
  ]);

  const playerIds = subs
    .filter((s: { user_id: string; onesignal_player_id: string }) => !practicedToday.has(s.user_id))
    .map((s: { onesignal_player_id: string }) => s.onesignal_player_id)
    .filter(Boolean);

  if (!playerIds.length) return NextResponse.json({ sent: 0 });

  const messages = [
    "⚡ Sua sequência está em risco! Pratique inglês agora.",
    "🔥 Não perca sua sequência! 5 minutos de prática fazem diferença.",
    "🎯 Hora de praticar inglês! Sua sequência te espera.",
    "💪 Um dia sem prática é um dia perdido. Vamos lá!",
  ];
  const msg = messages[new Date().getDate() % messages.length];

  await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${apiKey}`,
    },
    body: JSON.stringify({
      app_id: appId,
      include_player_ids: playerIds.slice(0, 2000),
      headings: { en: "Fale Inglês JV", pt: "Fale Inglês JV" },
      contents: { en: msg, pt: msg },
      url: "https://www.faleinglesjv.com/app",
    }),
  });

  return NextResponse.json({ sent: playerIds.length });
}
