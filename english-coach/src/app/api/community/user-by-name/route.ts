export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const name = req.nextUrl.searchParams.get("name");
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });

  // Try xp table first (has ALL registered users with display_name)
  const { data: xpUser } = await supabase
    .from("xp")
    .select("user_id, display_name")
    .ilike("display_name", `${name}%`)
    .limit(1)
    .maybeSingle();

  if (xpUser?.user_id) return NextResponse.json({ userId: xpUser.user_id });

  // Fallback: community_posts (catches users who have posted but aren't in xp table)
  const { data: postUser } = await supabase
    .from("community_posts")
    .select("user_id, display_name")
    .ilike("display_name", `${name}%`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ userId: postUser?.user_id ?? null });
}
