export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { pushToUser } from "@/lib/push";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

export async function GET(req: NextRequest) {
  const { userId: me } = await auth();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const targetId = req.nextUrl.searchParams.get("userId");
  if (!targetId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const db = supabase as any;

  const [followRow, followerCount, followingCount] = await Promise.all([
    db.from("user_follows").select("id").eq("follower_id", me).eq("following_id", targetId).maybeSingle(),
    db.from("user_follows").select("*", { count: "exact", head: true }).eq("following_id", targetId),
    db.from("user_follows").select("*", { count: "exact", head: true }).eq("follower_id", targetId),
  ]);

  return NextResponse.json({
    isFollowing: !!followRow.data,
    followerCount: followerCount.count ?? 0,
    followingCount: followingCount.count ?? 0,
  });
}

export async function POST(req: NextRequest) {
  const { userId: me } = await auth();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId: targetId } = await req.json();
  if (!targetId || targetId === me) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const db = supabase as any;

  const { data: existing } = await db
    .from("user_follows")
    .select("id")
    .eq("follower_id", me)
    .eq("following_id", targetId)
    .maybeSingle();

  if (existing) {
    await db.from("user_follows").delete().eq("id", existing.id);
  } else {
    await db.from("user_follows").insert({ follower_id: me, following_id: targetId });

    // Notify the followed user
    const [follower, followerXp] = await Promise.all([
      currentUser(),
      db.from("user_xp").select("display_name").eq("user_id", me).maybeSingle(),
    ]);
    const displayName = followerXp.data?.display_name
      ?? (follower?.firstName
        ? `${follower.firstName}${follower.lastName ? " " + follower.lastName : ""}`
        : follower?.username ?? "Alguém");
    const avatarUrl = follower?.imageUrl ?? null;

    await supabase.from("notifications").insert({
      user_id: targetId,
      type: "follow",
      from_user_id: me,
      from_display_name: displayName,
      from_avatar_url: avatarUrl,
    });

    pushToUser(
      targetId,
      `${displayName} começou a te seguir!`,
      "Veja o perfil dele na comunidade.",
      `https://www.faleinglesjv.com/app/comunidade/u/${me}`,
      avatarUrl ?? undefined
    ).catch(() => {});
  }

  const { count } = await db
    .from("user_follows")
    .select("*", { count: "exact", head: true })
    .eq("following_id", targetId);

  return NextResponse.json({ isFollowing: !existing, followerCount: count ?? 0 });
}
