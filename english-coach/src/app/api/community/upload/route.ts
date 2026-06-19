export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const type = form.get("type") as string | null; // "audio" | "image"

  if (!file || !type) return NextResponse.json({ error: "Missing file" }, { status: 400 });

  const ext = type === "audio" ? "webm" : file.name.split(".").pop() ?? "jpg";
  const path = `${type}/${userId}-${Date.now()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from("community-media")
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = supabase.storage.from("community-media").getPublicUrl(path);

  return NextResponse.json({ url: data.publicUrl });
}
