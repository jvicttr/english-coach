import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

// GET - Listar usuários (com suporte a busca)
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const searchParams = req.nextUrl.searchParams;
  const search = searchParams.get("search");

  try {
    let query = supabase.from("users").select("id, email, name, image_url");

    if (search) {
      query = query.neq("id", userId).ilike("name", `%${search}%`);
    } else {
      query = query.neq("id", userId);
    }

    const { data: users, error } = await query.order("created_at", { ascending: false });

    if (error) throw error;

    // Fetch handles + nomes personalizados do user_xp
    const ids = (users || []).map(u => u.id);
    const { data: xpRows } = ids.length
      ? await (supabase.from("user_xp") as any).select("user_id, handle, display_name").in("user_id", ids)
      : { data: [] };
    const handleMap = Object.fromEntries(((xpRows as any[]) || []).map((r: any) => [r.user_id, r.handle]));
    const nameMap = Object.fromEntries(((xpRows as any[]) || []).map((r: any) => [r.user_id, r.display_name]));

    // Última data de prática (mesma fonte usada no cálculo de streak)
    const { data: usageRows } = ids.length
      ? await supabase.from("usage").select("user_id, date").in("user_id", ids).order("date", { ascending: false })
      : { data: [] };
    const lastActiveMap: Record<string, string> = {};
    for (const row of (usageRows as any[]) || []) {
      if (!lastActiveMap[row.user_id]) lastActiveMap[row.user_id] = row.date;
    }

    // Auto-generate handle for users who don't have one yet
    const needsHandle = (users || []).filter(u => !handleMap[u.id]);
    if (needsHandle.length > 0) {
      const generated = needsHandle.map(u => {
        const firstName = (u.name || "user").split(" ")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
        const suffix = u.id.slice(-4).toLowerCase().replace(/[^a-z0-9]/g, "");
        const handle = `${firstName}_${suffix}`;
        handleMap[u.id] = handle;
        return { user_id: u.id, handle };
      });
      // Save in background — non-blocking
      (supabase.from("user_xp") as any).upsert(generated, { onConflict: "user_id" }).then(() => {});
    }

    const formattedUsers = (users || []).map((u) => ({
      id: u.id,
      email: u.email,
      name: nameMap[u.id] || u.name || u.email,
      image_url: u.image_url || null,
      handle: handleMap[u.id] ?? null,
      last_active: lastActiveMap[u.id] ?? null,
    }));

    return NextResponse.json({ users: formattedUsers });
  } catch (error) {
    console.error("Erro ao buscar usuários:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST - Sincronizar usuário quando fizer login
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { email, name, image } = await req.json();

    const fields: Record<string, string> = { id: userId, email, name };
    if (image) fields.image_url = image; // só atualiza foto se vier valor — evita apagar o que sync-all gravou

    const { data, error } = await supabase
      .from("users")
      .upsert(fields, { onConflict: "id" })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ user: data });
  } catch (error) {
    console.error("Erro ao sincronizar usuário:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
