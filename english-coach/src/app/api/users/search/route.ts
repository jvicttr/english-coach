import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  try {
    // Search users by name
    const { data: byName, error: nameError } = await supabase
      .from("users")
      .select("id, email, name, image_url")
      .neq("id", userId)
      .ilike("name", `%${q}%`)
      .order("name", { ascending: true })
      .limit(20);

    if (nameError) throw nameError;

    const ids = (byName || []).map(u => u.id);

    // Also search by handle in user_xp
    const { data: byHandle } = q
      ? await (supabase.from("user_xp") as any)
          .select("user_id, handle")
          .ilike("handle", `%${q}%`)
          .limit(20)
      : { data: [] };

    const handleUserIds = ((byHandle as any[]) || [])
      .map((r: any) => r.user_id)
      .filter((id: string) => id !== userId && !ids.includes(id));

    let extraUsers: typeof byName = [];
    if (handleUserIds.length > 0) {
      const { data } = await supabase
        .from("users")
        .select("id, email, name, image_url")
        .in("id", handleUserIds)
        .limit(20);
      extraUsers = data || [];
    }

    const allUsers = [...(byName || []), ...extraUsers];

    // Fetch all handles
    const allIds = allUsers.map(u => u.id);
    const { data: xpRows } = allIds.length
      ? await (supabase.from("user_xp") as any).select("user_id, handle").in("user_id", allIds)
      : { data: [] };

    const handleMap = Object.fromEntries(
      ((xpRows as any[]) || []).map((r: any) => [r.user_id, r.handle])
    );

    const formatted = allUsers.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name || u.email,
      image_url: u.image_url || null,
      handle: handleMap[u.id] ?? null,
    }));

    return NextResponse.json({ users: formatted });
  } catch (error) {
    console.error("Erro na busca de usuários:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
