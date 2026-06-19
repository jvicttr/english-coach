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
      const error = await clerkRes.text();
      console.error("Clerk API error:", clerkRes.status, error);
      return NextResponse.json({ error: "Clerk API failed", status: clerkRes.status, details: error }, { status: 500 });
    }

    const { data: clerkUsers } = await clerkRes.json();
    console.log("Syncing", clerkUsers?.length, "users from Clerk");

    let synced = 0;
    for (const user of clerkUsers || []) {
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

    return NextResponse.json({ synced, total: clerkUsers?.length || 0 });
  } catch (error) {
    console.error("Erro:", error);
    return NextResponse.json({ error: "Server error", details: String(error) }, { status: 500 });
  }
}
