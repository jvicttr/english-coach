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

  // Search community_posts by display_name — match exact or starts-with (handles "Nicolas" matching "Nicolas Ferreira")
  const { data: postUser } = await supabase
    .from("community_posts")
    .select("user_id, display_name")
    .or(`display_name.ilike.${name},display_name.ilike.${name} %`)
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ userId: postUser?.user_id ?? null });
}
