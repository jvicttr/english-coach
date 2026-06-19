import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

// GET - Sincronizar todos os usuários do Clerk
export async function GET(req: NextRequest) {
  try {
    // Buscar usuários do Clerk
    const clerkUrl = "https://api.clerk.com/v1/users?limit=500";
    const clerkRes = await fetch(clerkUrl, {
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      },
    });

    if (!clerkRes.ok) {
      const errorText = await clerkRes.text();
      console.error("Clerk API error:", clerkRes.status, errorText);
      return NextResponse.json({
        error: "Failed to fetch from Clerk",
        status: clerkRes.status,
        message: errorText
      }, { status: 500 });
    }

    const clerkData = await clerkRes.json();
    console.log("Clerk response:", JSON.stringify(clerkData));
    const clerkUsers = clerkData.data || [];
    console.log(`Found ${clerkUsers.length} users in Clerk`);

    // Sincronizar cada usuário
    let synced = 0;
    for (const user of clerkUsers) {
      const email = user.email_addresses?.[0]?.email_address || user.username || user.id;
      const name = user.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : user.username || user.id;

      await supabase.from("users").upsert({
        id: user.id,
        email,
        name,
        image_url: user.profile_image_url || null,
      }, { onConflict: "id" });

      synced++;
    }

    return NextResponse.json({ synced, total: clerkUsers.length });
  } catch (error) {
    console.error("Erro ao sincronizar usuários:", error);
    return NextResponse.json({ error: "Server error", details: String(error) }, { status: 500 });
  }
}
