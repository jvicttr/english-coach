import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

// POST - Atualizar status online
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { isOnline } = await req.json();

  const { data, error } = await supabase
    .from("user_presence")
    .upsert({
      user_id: userId,
      is_online: isOnline ?? true,
      last_seen: new Date().toISOString(),
    }, { onConflict: "user_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ presence: data });
}

// GET - Buscar usuários online
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userIds = searchParams.get("userIds")?.split(",");

  if (!userIds) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { data: presences, error } = await supabase
    .from("user_presence")
    .select("*")
    .in("user_id", userIds);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ presences });
}
