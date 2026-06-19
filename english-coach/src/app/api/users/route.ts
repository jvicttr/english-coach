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
      query = query.eq("id", search);
    } else {
      query = query.neq("id", userId);
    }

    const { data: users, error } = await query.order("created_at", { ascending: false });

    if (error) throw error;

    // Busca a foto mais recente dos posts da comunidade como fallback
    const userIds = (users || []).map((u) => u.id);
    let postAvatarMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: postAvatars } = await supabase
        .from("community_posts")
        .select("user_id, avatar_url")
        .in("user_id", userIds)
        .not("avatar_url", "is", null)
        .order("created_at", { ascending: false });

      // Pega a foto mais recente de cada usuário
      (postAvatars || []).forEach((p: any) => {
        if (p.avatar_url && !postAvatarMap[p.user_id]) {
          postAvatarMap[p.user_id] = p.avatar_url;
        }
      });
    }

    // Filtra URLs do Clerk CDN (avatar padrão) — mantém só fotos reais de provedores externos
    function realPhoto(url: string | null | undefined): string | null {
      if (!url) return null;
      if (url.includes("img.clerk.com")) return null;
      if (url.includes("images.clerk.dev")) return null;
      return url;
    }

    const formattedUsers = (users || []).map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name || u.email,
      image_url: realPhoto(postAvatarMap[u.id]) || realPhoto(u.image_url) || null,
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
