import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const { playerId } = await req.json();
    if (!playerId) return NextResponse.json({ ok: false });

    await supabase
      .from("subscriptions")
      .upsert({ user_id: userId, onesignal_player_id: playerId }, { onConflict: "user_id" });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
