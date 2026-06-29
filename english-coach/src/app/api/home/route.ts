export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { BADGES, getTier, TIERS } from "@/lib/xp";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function calcStreak(dateSet: Set<string>) {
  const today = new Date();
  let streak = 0;
  const check = new Date(today);
  while (dateSet.has(fmt(check))) { streak++; check.setDate(check.getDate() - 1); }
  if (streak === 0) {
    const yest = new Date(today); yest.setDate(today.getDate() - 1);
    const check2 = new Date(yest);
    while (dateSet.has(fmt(check2))) { streak++; check2.setDate(check2.getDate() - 1); }
  }
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    return dateSet.has(fmt(d));
  });
  return { streak, weekDays };
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date().toISOString().split("T")[0];

  const [
    user,
    { data: sub },
    { data: usageData },
    { data: quizData },
    { data: xpRow },
    { data: badgeRows },
    { data: trilhaCompleted },
    { data: trilhaSessions },
    { data: flashcards },
    { data: hardCards },
    { data: communityData },
    { data: xpHistory },
  ] = await Promise.all([
    currentUser(),
    supabase.from("subscriptions").select("plan, level, english_level").eq("user_id", userId).single(),
    supabase.from("usage").select("date").eq("user_id", userId).order("date", { ascending: false }).limit(60),
    supabase.from("quiz_results").select("created_at").eq("user_id", userId).not("score", "is", null).order("created_at", { ascending: false }).limit(100),
    supabase.from("user_xp").select("total_xp").eq("user_id", userId).single(),
    supabase.from("user_badges").select("badge_id, earned_at").eq("user_id", userId),
    supabase.from("learning_path_progress").select("step_id, completed_at").eq("user_id", userId),
    supabase.from("trilha_sessions").select("step_id").eq("user_id", userId),
    supabase.from("flashcards").select("next_review").eq("user_id", userId).lte("next_review", today),
    supabase.from("flashcards").select("pack_id, pack_name, ease_factor").eq("user_id", userId).lt("ease_factor", 1.6),
    supabase.from("community_posts").select("created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(60),
  ]);

  const isPro = sub?.plan === "pro";

  // Streak — conta qualquer atividade no app (chat IA, quiz, post na comunidade)
  const dateSet = new Set<string>();
  for (const r of usageData ?? []) dateSet.add(r.date);
  for (const r of quizData ?? []) dateSet.add((r.created_at as string).split("T")[0]);
  for (const r of communityData ?? []) dateSet.add((r.created_at as string).split("T")[0]);
  const { streak, weekDays } = calcStreak(dateSet);

  // Recommendation — find the pack with the most hard cards (ease_factor < 1.6)
  let recommendation: { packName: string; hardCount: number } | null = null;
  if (isPro && hardCards && hardCards.length > 0) {
    const packCounts = new Map<string, { name: string; count: number }>();
    for (const c of hardCards as { pack_id: string; pack_name: string }[]) {
      const key = c.pack_id ?? "__legacy__";
      const existing = packCounts.get(key);
      if (existing) existing.count++;
      else packCounts.set(key, { name: c.pack_name ?? "Flashcards", count: 1 });
    }
    const [, top] = [...packCounts.entries()].sort((a, b) => b[1].count - a[1].count)[0] ?? [];
    if (top && top.count >= 2) recommendation = { packName: top.name, hardCount: top.count };
  }

  // XP
  const totalXp = xpRow?.total_xp ?? 0;
  const tier = getTier(totalXp);
  const nextTier = TIERS.find((t) => t.min > tier.min) ?? null;
  const earnedMap = new Map((badgeRows ?? []).map((b: { badge_id: string; earned_at: string }) => [b.badge_id, b.earned_at]));
  const badges = BADGES.map((b) => ({ id: b.id, earned: earnedMap.has(b.id) }));

  return NextResponse.json({
    // User
    firstName: user?.firstName ?? null,
    isPro,
    englishLevel: sub?.english_level ?? null,
    hasLevel: !!(sub?.english_level),
    // Streak
    streak,
    weekDays,
    // XP
    totalXp,
    tier,
    nextTier,
    badges,
    // Trilha (only meaningful for Pro, but always returned to avoid extra round-trip)
    trilhaCompleted: trilhaCompleted ?? [],
    trilhaActiveSessions: (trilhaSessions ?? []).map((s: { step_id: string }) => s.step_id),
    // Flashcards
    flashcardPending: isPro ? (flashcards?.length ?? 0) : 0,
    recommendation,
  });
}
