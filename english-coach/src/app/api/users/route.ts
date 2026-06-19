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
    // Buscar usuários do Clerk via API
    const clerkUrl = "https://api.clerk.com/v1/users";
    const clerkRes = await fetch(clerkUrl, {
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      },
    });

    if (!clerkRes.ok) {
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    const clerkData = await clerkRes.json();
    const users = (clerkData.data || [])
      .filter((u: any) => u.id !== userId)
      .map((u: any) => ({
        id: u.id,
        email: u.email_addresses?.[0]?.email_address || u.username || u.id,
        name: u.first_name ? `${u.first_name} ${u.last_name || ""}`.trim() : u.username || u.id,
        image: u.profile_image_url || null,
      }));

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Erro ao buscar usuários:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
