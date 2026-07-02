import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushMulticast } from "@/lib/fcm";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

const MESSAGES = {
  morning: {
    title: "Bom dia! 🌅",
    body: "Que tal uma conversa rápida em inglês antes de começar o dia?",
  },
  afternoon: {
    title: "Hora de praticar! 🎯",
    body: "Seu inglês melhora todo dia. Que tal uma conversa rápida agora?",
  },
};

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Busca todos os FCM tokens cadastrados
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("fcm_token")
    .not("fcm_token", "is", null);

  const tokens = (subs ?? []).map((s) => s.fcm_token).filter(Boolean) as string[];

  if (tokens.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "No FCM tokens registered" });
  }

  const utcHour = new Date().getUTCHours();
  const msg = utcHour < 14 ? MESSAGES.morning : MESSAGES.afternoon;

  await sendPushMulticast(tokens, msg.title, msg.body, "https://www.faleinglesjv.com/app");

  console.log(`[notify cron] sent to ${tokens.length} devices (${utcHour < 14 ? "morning" : "afternoon"})`);
  return NextResponse.json({ ok: true, sent: tokens.length });
}
