import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

// POST - Adicionar/remover reação
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { messageId, emoji, remove } = await req.json();

  if (!messageId || !emoji) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (remove) {
    // Remove UMA ocorrência da reação deste usuário
    const { data: existing } = await supabase
      .from("message_reactions")
      .select("id")
      .eq("message_id", messageId)
      .eq("user_id", userId)
      .eq("emoji", emoji)
      .limit(1)
      .single();

    if (existing) {
      await supabase.from("message_reactions").delete().eq("id", existing.id);
    }
    return NextResponse.json({ action: "removed" });
  }

  // Sempre insere — permite múltiplas reações iguais do mesmo usuário
  const { data: reaction, error } = await supabase
    .from("message_reactions")
    .insert({ message_id: messageId, user_id: userId, emoji })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reaction, action: "added" });
}
