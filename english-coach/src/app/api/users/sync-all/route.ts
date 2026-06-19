import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { clerkClient } from "@clerk/nextjs/server";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

// GET - Sincronizar todos os usuários do Clerk
export async function GET(req: NextRequest) {
  try {
    // Buscar usuários do Clerk usando SDK
    const { data: clerkUsers } = await clerkClient.users.getUserList({ limit: 500 });

    // Sincronizar cada usuário
    let synced = 0;
    for (const user of clerkUsers || []) {
      const email = user.emailAddresses?.[0]?.emailAddress || user.username || user.id;
      const name = user.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : user.username || user.id;

      await supabase.from("users").upsert({
        id: user.id,
        email,
        name,
        image_url: user.imageUrl || null,
      }, { onConflict: "id" });

      synced++;
    }

    return NextResponse.json({ synced, total: clerkUsers?.length || 0 });
  } catch (error) {
    console.error("Erro ao sincronizar usuários:", error);
    return NextResponse.json({ error: "Server error", details: String(error) }, { status: 500 });
  }
}
