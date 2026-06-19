import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

// GET - Listar todos os usuários (exceto o atual)
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Buscar usuários do Supabase
    const { data: users, error } = await supabase
      .from("users")
      .select("id, email, name, image_url")
      .neq("id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const formattedUsers = (users || []).map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name || u.email,
      image: u.image_url,
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
