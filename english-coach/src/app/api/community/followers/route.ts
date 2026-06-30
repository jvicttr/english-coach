export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

export async function GET(req: NextRequest) {
  const { userId: me } = await auth();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const targetId = req.nextUrl.searchParams.get("userId");
  const type = req.nextUrl.searchParams.get("type") ?? "followers"; // "followers" | "following"
  if (!targetId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const db = supabase as any;

  let userIds: string[] = [];

  if (type === "followers") {
    const { data } = await db.from("user_follows").select("follower_id").eq("following_id", targetId);
    userIds = (data ?? []).map((r: any) => r.follower_id);
  } else {
    const { data } = await db.from("user_follows").select("following_id").eq("follower_id", targetId);
    userIds = (data ?? []).map((r: any) => r.following_id);
  }

  if (userIds.length === 0) return NextResponse.json({ users: [] });

  // Fetch display names and avatars
  const [xpRows, clerk] = await Promise.all([
    (supabase as any).from("user_xp").select("user_id, display_name, handle").in("user_id", userIds),
    (async () => {
      try {
        const client = await clerkClient();
        const results = await Promise.all(userIds.map(id => client.users.getUser(id).catch(() => null)));
        return results;
      } catch {
        return [];
      }
    })(),
  ]);

  const xpMap: Record<string, { display_name: string | null; handle: string | null }> = {};
  for (const x of xpRows.data ?? []) xpMap[x.user_id] = { display_name: x.display_name, handle: x.handle };

  const clerkMap: Record<string, { name: string; avatar: string | null }> = {};
  for (const u of clerk) {
    if (!u) continue;
    const name = u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.firstName ?? u.username ?? "Student";
    clerkMap[u.id] = { name, avatar: u.imageUrl ?? null };
  }

  const users = userIds.map(id => {
    const xp = xpMap[id];
    const cl = clerkMap[id];
    return {
      user_id: id,
      display_name: xp?.display_name ?? cl?.name ?? "Student",
      avatar_url: cl?.avatar ?? null,
      handle: xp?.handle ?? null,
    };
  });

  return NextResponse.json({ users });
}
