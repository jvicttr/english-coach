import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 1. Buscar todas as conversas do usuário
  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("id, user1_id, user2_id, updated_at")
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .order("updated_at", { ascending: false });

  if (error || !conversations?.length) return NextResponse.json({ conversations: [] });

  // 2. Coletar IDs dos outros usuários
  const otherUserIds = conversations.map((c: any) =>
    c.user1_id === userId ? c.user2_id : c.user1_id
  );

  // 3. Buscar dados dos outros usuários
  const { data: users } = await supabase
    .from("users")
    .select("id, name, image_url")
    .in("id", otherUserIds);

  const userMap: Record<string, any> = {};
  users?.forEach((u: any) => { userMap[u.id] = u; });

  // 4. Buscar última mensagem de cada conversa
  const convIds = conversations.map((c: any) => c.id);
  const { data: lastMessages } = await supabase
    .from("direct_messages")
    .select("conversation_id, content, created_at, sender_id")
    .in("conversation_id", convIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const lastMsgMap: Record<string, any> = {};
  lastMessages?.forEach((m: any) => {
    if (!lastMsgMap[m.conversation_id]) lastMsgMap[m.conversation_id] = m;
  });

  // 5. Buscar last_read do usuário para calcular não-lidas
  const { data: lastReads } = await supabase
    .from("message_last_read")
    .select("conversation_id, last_read_at")
    .eq("user_id", userId);

  const lastReadMap: Record<string, string> = {};
  lastReads?.forEach((r: any) => { lastReadMap[r.conversation_id] = r.last_read_at; });

  // 6. Contar mensagens não lidas por conversa
  const { data: allUnread } = await supabase
    .from("direct_messages")
    .select("conversation_id, created_at")
    .in("conversation_id", convIds)
    .neq("sender_id", userId)
    .is("deleted_at", null);

  const unreadMap: Record<string, number> = {};
  allUnread?.forEach((m: any) => {
    const lastRead = lastReadMap[m.conversation_id];
    if (!lastRead || new Date(m.created_at) > new Date(lastRead)) {
      unreadMap[m.conversation_id] = (unreadMap[m.conversation_id] || 0) + 1;
    }
  });

  // 7. Montar resultado final
  const enriched = conversations.map((c: any) => {
    const otherId = c.user1_id === userId ? c.user2_id : c.user1_id;
    const other = userMap[otherId] || { id: otherId, name: "Usuário", image_url: null };
    const lastMsg = lastMsgMap[c.id] || null;
    return {
      conversation_id: c.id,
      other_user: other,
      last_message: lastMsg ? {
        content: lastMsg.content,
        audio_url: lastMsg.audio_url,
        image_url: lastMsg.image_url,
        created_at: lastMsg.created_at,
        is_mine: lastMsg.sender_id === userId,
      } : null,
      unread_count: unreadMap[c.id] || 0,
      updated_at: c.updated_at,
    };
  });

  return NextResponse.json({ conversations: enriched });
}
