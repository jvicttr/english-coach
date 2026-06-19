import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const clerkRes = await fetch("https://api.clerk.com/v1/users?limit=500", {
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      },
    });

    if (!clerkRes.ok) {
      return NextResponse.json({ error: "Clerk API failed", status: clerkRes.status }, { status: 500 });
    }

    const clerkUsers = await clerkRes.json();
    const users = Array.isArray(clerkUsers) ? clerkUsers : clerkUsers?.data || [];

    let synced = 0;
    for (const user of users) {
      const email = user.email_addresses?.[0]?.email_address || user.username || user.id;
      const name = user.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : user.username || user.id;

      await supabase.from("users").upsert({
        id: user.id,
        email,
        name,
        // profile_image_url retorna URL estável do Google sem assinatura que expira
      image_url: (user.profile_image_url && !user.profile_image_url.includes("gravatar")) ? user.profile_image_url : null,
      }, { onConflict: "id" });

      synced++;
    }

    return NextResponse.json({ synced, total: users.length });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
