import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const clerkRes = await fetch("https://api.clerk.com/v1/users?limit=20", {
      headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
    });

    const clerkUsers = await clerkRes.json();
    const users = Array.isArray(clerkUsers) ? clerkUsers : clerkUsers?.data || [];

    const debug = users.map((u: any) => ({
      name: `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.id,
      image_url: u.image_url || null,
      profile_image_url: u.profile_image_url || null,
      has_image: u.has_image,
      external_accounts: (u.external_accounts || []).map((a: any) => ({
        provider: a.provider,
        image_url: a.image_url || null,
      })),
    }));

    return NextResponse.json({ users: debug });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
