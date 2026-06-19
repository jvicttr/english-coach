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

    // Se há busca, inclui o usuário procurado mesmo que seja o próprio
    if (search) {
      query = query.eq("id", search);
    } else {
      // Caso contrário, lista todos exceto o atual
      query = query.neq("id", userId);
    }

    const { data: users, error } = await query.order("created_at", { ascending: false });

    if (error) throw error;

    const formattedUsers = (users || []).map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name || u.email,
      image_url: u.image_url,
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

    const { data, error } = await supabase
      .from("users")
      .upsert({
        id: userId,
        email,
        name,
        image_url: image,
      }, { onConflict: "id" })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ user: data });
  } catch (error) {
    console.error("Erro ao sincronizar usuário:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
