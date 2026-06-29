export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { getTier } from "@/lib/xp";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: top } = await supabase
    .from("user_xp")
    .select("user_id, total_xp, display_name")
    .order("total_xp", { ascending: false })
    .limit(10);

  // For rows missing display_name, fetch from Clerk and backfill
  const missingIds = (top ?? []).filter(r => !r.display_name).map(r => r.user_id);
  const clerkNames: Record<string, string> = {};
  if (missingIds.length > 0) {
    try {
      const clerk = await clerkClient();
      await Promise.all(missingIds.map(async (uid) => {
        try {
          const u = await clerk.users.getUser(uid);
          const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.username;
          if (name) {
            clerkNames[uid] = name;
            // Backfill so next load is fast
            supabase.from("user_xp").update({ display_name: name }).eq("user_id", uid).then(() => {});
          }
        } catch { /* skip */ }
      }));
    } catch { /* non-fatal */ }
  }

  const ranking = (top ?? []).map((row: { user_id: string; total_xp: number; display_name: string | null }, i: number) => ({
    position: i + 1,
    userId: row.user_id,
    displayName: row.display_name ?? clerkNames[row.user_id] ?? "Aluno",
    totalXp: row.total_xp,
    tier: getTier(row.total_xp),
    isMe: row.user_id === userId,
  }));

  // Find current user's position if not in top 10
  let myPosition: number | null = null;
  let myXp = 0;
  const inTop = ranking.some((r) => r.isMe);
  if (!inTop) {
    const { count } = await supabase
      .from("user_xp")
      .select("*", { count: "exact", head: true })
      .gt("total_xp", 0);

    const { data: myRow } = await supabase
      .from("user_xp")
      .select("total_xp")
      .eq("user_id", userId)
      .single();

    myXp = myRow?.total_xp ?? 0;

    const { count: above } = await supabase
      .from("user_xp")
      .select("*", { count: "exact", head: true })
      .gt("total_xp", myXp);

    myPosition = (above ?? 0) + 1;
    void count;
  }

  return NextResponse.json({ ranking, myPosition, myXp });
}
