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

  // Try exact handle match first (unambiguous)
  const { data: handleUser } = await supabase
    .from("user_xp")
    .select("user_id")
    .filter("handle", "ilike", name)
    .maybeSingle();

  if (handleUser?.user_id) return NextResponse.json({ userId: handleUser.user_id });

  // Fallback: display_name prefix match (legacy posts without handle)
  const { data: xpUser } = await supabase
    .from("user_xp")
    .select("user_id, display_name")
    .ilike("display_name", `${name}%`)
    .limit(1)
    .maybeSingle();

  if (xpUser?.user_id) return NextResponse.json({ userId: xpUser.user_id });

  // Last resort: community_posts
  const { data: postUser } = await supabase
    .from("community_posts")
    .select("user_id")
    .ilike("display_name", `${name}%`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ userId: postUser?.user_id ?? null });
}
