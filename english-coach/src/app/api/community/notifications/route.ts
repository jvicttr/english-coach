export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);

  const unread = (data ?? []).filter((n) => !n.read).length;

  return NextResponse.json({ notifications: data ?? [], unread });
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids } = await req.json().catch(() => ({ ids: null }));

  if (ids?.length) {
    await supabase.from("notifications").update({ read: true }).in("id", ids).eq("user_id", userId);
  } else {
    await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
  }

  return NextResponse.json({ ok: true });
}
