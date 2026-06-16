export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ plan: "free" });

  const today = new Date().toISOString().split("T")[0];

  const [sub, user, usage] = await Promise.all([
    supabase.from("subscriptions").select("plan, level, english_level").eq("user_id", userId).single(),
    currentUser(),
    supabase.from("usage").select("count").eq("user_id", userId).eq("date", today).single(),
  ]);

  return NextResponse.json({
    plan: sub.data?.plan ?? "free",
    level: sub.data?.level ?? null,
    englishLevel: sub.data?.english_level ?? null,
    firstName: user?.firstName ?? null,
    messagesUsed: usage.data?.count ?? 0,
  });
}
