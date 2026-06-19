import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

// POST - Iniciar ou buscar conversa com outro usuário
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { otherUserId } = await req.json();

  if (!otherUserId || otherUserId === userId) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  // Buscar conversa existente
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .or(`and(user1_id.eq.${userId},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${userId})`)
    .single();

  if (existing) {
    return NextResponse.json({ conversationId: existing.id });
  }

  // Criar nova conversa
  const { data: conversation, error } = await supabase
    .from("conversations")
    .insert({
      user1_id: userId,
      user2_id: otherUserId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversationId: conversation.id });
}
