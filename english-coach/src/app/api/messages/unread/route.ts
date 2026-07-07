import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

// GET - Contar mensagens não lidas
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ unread: 0 });

  try {
    // Buscar todas as conversas do usuário
    const { data: conversations } = await supabase
      .from("conversations")
      .select("id, user1_id, user2_id")
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

    if (!conversations?.length) return NextResponse.json({ unread: 0, messages: [] });

    const convIds = conversations.map((c: any) => c.id);

    // Buscar mensagens não lidas (de outros usuários, depois do last_read)
    const { data: messages } = await supabase
      .from("direct_messages")
      .select("id, conversation_id, sender_id, content, created_at")
      .in("conversation_id", convIds)
      .neq("sender_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20);

    // Buscar last_read do usuário
    const { data: lastReads } = await supabase
      .from("message_last_read")
      .select("conversation_id, last_read_at")
      .eq("user_id", userId);

    const lastReadMap: Record<string, string> = {};
    lastReads?.forEach((r: any) => { lastReadMap[r.conversation_id] = r.last_read_at; });

    // Filtrar apenas mensagens após o último acesso
    const unreadMessages = (messages || []).filter((msg: any) => {
      const lastRead = lastReadMap[msg.conversation_id];
      if (!lastRead) return true;
      return new Date(msg.created_at) > new Date(lastRead);
    });

    // Enriquecer com nome do remetente (nome personalizado tem prioridade sobre o do Clerk)
    const senderIds = [...new Set(unreadMessages.map((m: any) => m.sender_id))];
    const [{ data: senders }, { data: senderXp }] = await Promise.all([
      supabase.from("users").select("id, name, image_url").in("id", senderIds),
      supabase.from("user_xp").select("user_id, display_name").in("user_id", senderIds),
    ]);

    const senderMap: Record<string, any> = {};
    senders?.forEach((s: any) => { senderMap[s.id] = s; });
    const nameMap: Record<string, string> = {};
    senderXp?.forEach((x: any) => { if (x.display_name) nameMap[x.user_id] = x.display_name; });

    const enriched = unreadMessages.map((msg: any) => ({
      ...msg,
      sender_name: nameMap[msg.sender_id] || senderMap[msg.sender_id]?.name || "Alguém",
      sender_image: senderMap[msg.sender_id]?.image_url || null,
    }));

    return NextResponse.json({ unread: enriched.length, messages: enriched });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ unread: 0, messages: [] });
  }
}

// POST - Marcar conversa como lida
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ ok: false });

  try {
    const { conversationId } = await req.json();
    await supabase
      .from("message_last_read")
      .upsert({ user_id: userId, conversation_id: conversationId, last_read_at: new Date().toISOString() }, { onConflict: "user_id,conversation_id" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false });
  }
}
