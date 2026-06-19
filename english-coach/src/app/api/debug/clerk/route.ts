import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const res = await fetch("https://api.clerk.com/v1/users?limit=500", {
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      },
    });

    const data = await res.json();

    return NextResponse.json({
      status: res.status,
      ok: res.ok,
      response: data,
      key: process.env.CLERK_SECRET_KEY?.slice(0, 10) + "..."
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) });
  }
}
