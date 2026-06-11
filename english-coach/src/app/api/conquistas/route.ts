import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { BADGES, TIERS, getTier } from "@/lib/xp";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch user display name from Clerk and update in DB
  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const displayName =
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
      user.username ||
      "Aluno";
    await supabase
      .from("user_xp")
      .upsert({ user_id: userId, display_name: displayName, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  } catch { /* non-fatal */ }

  const [{ data: xpRow }, { data: badgeRows }] = await Promise.all([
    supabase.from("user_xp").select("total_xp, message_count, flashcard_reviews").eq("user_id", userId).single(),
    supabase.from("user_badges").select("badge_id, earned_at").eq("user_id", userId),
  ]);

  const totalXp = xpRow?.total_xp ?? 0;
  const tier = getTier(totalXp);
  const nextTier = TIERS.find((t) => t.min > tier.min);
  const earnedMap = new Map((badgeRows ?? []).map((b: { badge_id: string; earned_at: string }) => [b.badge_id, b.earned_at]));

  const badges = BADGES.map((b) => ({
    ...b,
    earned: earnedMap.has(b.id),
    earned_at: earnedMap.get(b.id) ?? null,
  }));

  return NextResponse.json({
    totalXp,
    tier,
    nextTier: nextTier ?? null,
    badges,
    messageCount: xpRow?.message_count ?? 0,
    flashcardReviews: xpRow?.flashcard_reviews ?? 0,
  });
}
