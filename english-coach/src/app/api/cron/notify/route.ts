import { NextRequest, NextResponse } from "next/server";

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID!;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY!;

const MESSAGES = {
  morning: {
    headings: "Bom dia! 🌅",
    contents: "Que tal uma conversa rápida em inglês antes de começar o dia?",
  },
  afternoon: {
    headings: "Hora de praticar! 🎯",
    contents: "Seu inglês melhora todo dia. Que tal uma conversa rápida agora?",
  },
};

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Determine which message based on UTC hour
  // 11 UTC = 8h BRT (morning), 20 UTC = 17h BRT (afternoon)
  const utcHour = new Date().getUTCHours();
  const msg = utcHour < 14 ? MESSAGES.morning : MESSAGES.afternoon;

  const body = {
    app_id: ONESIGNAL_APP_ID,
    included_segments: ["All"],
    headings: { en: msg.headings, pt: msg.headings },
    contents: { en: msg.contents, pt: msg.contents },
    url: "https://app.faleinglesjv.com/app",
    web_url: "https://app.faleinglesjv.com/app",
    chrome_web_icon: "https://app.faleinglesjv.com/favicon.png",
  };

  const res = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${ONESIGNAL_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("[notify cron] OneSignal error:", data);
    return NextResponse.json({ error: data }, { status: 500 });
  }

  console.log(`[notify cron] sent (${utcHour < 14 ? "morning" : "afternoon"}):`, data.id);
  return NextResponse.json({ ok: true, id: data.id, type: utcHour < 14 ? "morning" : "afternoon" });
}
