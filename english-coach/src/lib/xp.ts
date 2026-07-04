import { createClient } from "@supabase/supabase-js";
import { clerkClient } from "@clerk/nextjs/server";
import { TRAIL_STEPS } from "./trilha-steps";
export { TIERS, getTier } from "./tiers";
export type { Tier } from "./tiers";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

export type BadgeId =
  | "first_message" | "messages_100" | "messages_500" | "messages_1000"
  | "streak_7" | "streak_30" | "streak_60" | "streak_100"
  | "flashcards_50" | "flashcards_200" | "flashcards_500" | "flashcards_1000"
  | "quiz_perfect" | "quiz_5_90" | "quiz_10_90" | "quiz_20_any"
  | "trail_a1" | "trail_a2" | "trail_b1" | "trail_b2" | "trail_c1"
  | "level_advanced"
  | "tier_silver" | "tier_gold" | "tier_platinum" | "tier_diamond" | "tier_legend"
  | "community_first_post" | "community_10_posts" | "community_liked"
  | "app_installed";

export type Badge = {
  id: BadgeId;
  emoji: string;
  title: string;
  desc: string;
  xpReward: number;
};

export const BADGES: Badge[] = [
  // Mensagens
  { id: "first_message",     emoji: "💬", title: "Primeira Conversa",   desc: "Enviou sua primeira mensagem em inglês",        xpReward: 10  },
  { id: "messages_100",      emoji: "💪", title: "Falante Ativo",        desc: "100 mensagens enviadas",                        xpReward: 30  },
  { id: "messages_500",      emoji: "🗣️", title: "Conversador Nato",     desc: "500 mensagens enviadas",                        xpReward: 100 },
  { id: "messages_1000",     emoji: "🎙️", title: "Mestre das Palavras",  desc: "1.000 mensagens enviadas",                      xpReward: 300 },
  // Streak
  { id: "streak_7",          emoji: "🔥", title: "Semana de Fogo",       desc: "7 dias seguidos praticando",                    xpReward: 50  },
  { id: "streak_30",         emoji: "⚡", title: "Mês Dedicado",         desc: "30 dias seguidos praticando",                   xpReward: 200 },
  { id: "streak_60",         emoji: "🌊", title: "Imparável",            desc: "60 dias seguidos praticando",                   xpReward: 400 },
  { id: "streak_100",        emoji: "💫", title: "Lendário",             desc: "100 dias seguidos praticando",                  xpReward: 700 },
  // Flashcards
  { id: "flashcards_50",     emoji: "🃏", title: "Estudante",            desc: "50 flashcards revisados",                       xpReward: 30  },
  { id: "flashcards_200",    emoji: "📚", title: "Vocabulário Rico",     desc: "200 flashcards revisados",                      xpReward: 100 },
  { id: "flashcards_500",    emoji: "🧠", title: "Memória de Elefante",  desc: "500 flashcards revisados",                      xpReward: 250 },
  { id: "flashcards_1000",   emoji: "📖", title: "Enciclopédia Viva",    desc: "1.000 flashcards revisados",                    xpReward: 500 },
  // Quiz
  { id: "quiz_perfect",      emoji: "⭐", title: "Quiz Perfeito",        desc: "100% de acerto em um quiz",                     xpReward: 50  },
  { id: "quiz_5_90",         emoji: "🎯", title: "Consistente",          desc: "5 quizzes com 90% ou mais",                     xpReward: 80  },
  { id: "quiz_10_90",        emoji: "🏹", title: "Atirador de Elite",    desc: "10 quizzes com 90% ou mais",                    xpReward: 180 },
  { id: "quiz_20_any",       emoji: "🧩", title: "Quiz Máquina",         desc: "20 quizzes completados",                        xpReward: 150 },
  // Trilha
  { id: "trail_a1",          emoji: "🌱", title: "A1 Completo",          desc: "Concluiu todas as etapas do nível A1",          xpReward: 100 },
  { id: "trail_a2",          emoji: "🌿", title: "A2 Completo",          desc: "Concluiu todas as etapas do nível A2",          xpReward: 150 },
  { id: "trail_b1",          emoji: "🌳", title: "B1 Completo",          desc: "Concluiu todas as etapas do nível B1",          xpReward: 200 },
  { id: "trail_b2",          emoji: "🦅", title: "B2 Completo",          desc: "Concluiu todas as etapas do nível B2",          xpReward: 250 },
  { id: "trail_c1",          emoji: "👑", title: "Maestria",             desc: "Concluiu todas as etapas do nível C1",          xpReward: 500 },
  // Nível / Coach
  { id: "level_advanced",    emoji: "🚀", title: "Nível Avançado",       desc: "Atingiu o nível avançado",                      xpReward: 100 },
  // Tiers
  { id: "tier_silver",       emoji: "🥈", title: "Tier Prata",           desc: "Alcançou o tier Prata (700 XP)",                xpReward: 50  },
  { id: "tier_gold",         emoji: "🥇", title: "Tier Ouro",            desc: "Alcançou o tier Ouro (2.500 XP)",               xpReward: 100 },
  { id: "tier_platinum",     emoji: "💎", title: "Tier Platina",         desc: "Alcançou o tier Platina (6.000 XP)",            xpReward: 200 },
  { id: "tier_diamond",      emoji: "💠", title: "Tier Diamante",        desc: "Alcançou o tier Diamante (13.000 XP)",          xpReward: 350 },
  { id: "tier_legend",       emoji: "👑", title: "Tier Lenda",           desc: "Alcançou o tier Lenda (25.000 XP)",             xpReward: 600 },
  // Comunidade
  { id: "community_first_post", emoji: "📢", title: "Voz da Comunidade", desc: "Publicou seu primeiro post na comunidade",      xpReward: 20  },
  { id: "community_10_posts",   emoji: "🌐", title: "Influencer",        desc: "10 posts publicados na comunidade",             xpReward: 80  },
  { id: "community_liked",      emoji: "❤️", title: "Querido pela Turma", desc: "Recebeu 10 curtidas em posts",                 xpReward: 60  },
  // App
  { id: "app_installed",        emoji: "📲", title: "App Instalado",      desc: "Adicionou o JV IA à tela inicial",             xpReward: 1000 },
];


async function getCurrentStreak(userId: string): Promise<number> {
  const { data } = await supabase
    .from("usage")
    .select("date")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(35);

  if (!data || data.length === 0) return 0;
  const dateSet = new Set(data.map((d: { date: string }) => d.date));
  let streak = 0;
  const check = new Date();
  while (dateSet.has(check.toISOString().split("T")[0])) {
    streak++;
    check.setDate(check.getDate() - 1);
  }
  return streak;
}

export type XPEvent =
  | { type: "message"; detectedLevel?: string }
  | { type: "quiz"; score: number; total: number }
  | { type: "flashcard" }
  | { type: "trail_step"; stepId: string }
  | { type: "app_installed" };

export async function grantXP(userId: string, event: XPEvent): Promise<{ newXp: number; newBadges: Badge[] }> {
  // Get current state (also fetch display_name to know if it needs filling)
  const { data: current } = await supabase
    .from("user_xp")
    .select("total_xp, message_count, flashcard_reviews, display_name")
    .eq("user_id", userId)
    .single();

  const prevXp = current?.total_xp ?? 0;
  const prevMessages = current?.message_count ?? 0;
  const prevFlashcards = current?.flashcard_reviews ?? 0;

  // Resolve display_name from Clerk if missing
  let displayName: string | undefined;
  if (!current?.display_name) {
    try {
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(userId);
      const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.username;
      if (name) displayName = name;
    } catch { /* non-fatal */ }
  }

  // Calculate XP for this event
  let xpGained = 0;
  let newMessages = prevMessages;
  let newFlashcards = prevFlashcards;

  if (event.type === "message") {
    xpGained = 5;
    newMessages = prevMessages + 1;
  } else if (event.type === "quiz") {
    xpGained = 20 + (event.score / event.total >= 0.9 ? 10 : 0);
  } else if (event.type === "flashcard") {
    xpGained = 3;
    newFlashcards = prevFlashcards + 1;
  } else if (event.type === "trail_step") {
    xpGained = 50;
  }

  // Determine which badges to check
  const badgesToCheck: BadgeId[] = [];

  if (event.type === "message") {
    if (newMessages === 1) badgesToCheck.push("first_message");
    if (newMessages >= 100) badgesToCheck.push("messages_100");
    if (newMessages >= 500) badgesToCheck.push("messages_500");
    if (newMessages >= 1000) badgesToCheck.push("messages_1000");
    if (event.detectedLevel === "advanced") badgesToCheck.push("level_advanced");
    badgesToCheck.push("streak_7", "streak_30", "streak_60", "streak_100");
  } else if (event.type === "quiz") {
    if (event.score === event.total) badgesToCheck.push("quiz_perfect");
    badgesToCheck.push("quiz_5_90", "quiz_10_90", "quiz_20_any");
  } else if (event.type === "flashcard") {
    if (newFlashcards >= 50) badgesToCheck.push("flashcards_50");
    if (newFlashcards >= 200) badgesToCheck.push("flashcards_200");
    if (newFlashcards >= 500) badgesToCheck.push("flashcards_500");
    if (newFlashcards >= 1000) badgesToCheck.push("flashcards_1000");
  } else if (event.type === "trail_step") {
    const step = TRAIL_STEPS.find((s) => s.id === event.stepId);
    if (step) {
      badgesToCheck.push(`trail_${step.level.toLowerCase()}` as BadgeId);
    }
  } else if (event.type === "app_installed") {
    badgesToCheck.push("app_installed");
  }
  // Tier badges — check on every XP event
  badgesToCheck.push("tier_silver", "tier_gold", "tier_platinum", "tier_diamond", "tier_legend");

  // Get already-earned badges
  const { data: earned } = await supabase
    .from("user_badges")
    .select("badge_id")
    .eq("user_id", userId);
  const earnedSet = new Set((earned ?? []).map((b: { badge_id: string }) => b.badge_id));

  // Check badge conditions and award new ones
  const newBadges: Badge[] = [];
  let bonusXp = 0;

  for (const badgeId of badgesToCheck) {
    if (earnedSet.has(badgeId)) continue;
    const badge = BADGES.find((b) => b.id === badgeId);
    if (!badge) continue;

    let earned = false;

    if (badgeId === "first_message") {
      earned = newMessages >= 1;
    } else if (badgeId === "messages_100") {
      earned = newMessages >= 100;
    } else if (badgeId === "messages_500") {
      earned = newMessages >= 500;
    } else if (badgeId === "messages_1000") {
      earned = newMessages >= 1000;
    } else if (badgeId === "streak_7" || badgeId === "streak_30" || badgeId === "streak_60" || badgeId === "streak_100") {
      const streak = await getCurrentStreak(userId);
      const target = badgeId === "streak_7" ? 7 : badgeId === "streak_30" ? 30 : badgeId === "streak_60" ? 60 : 100;
      earned = streak >= target;
    } else if (badgeId === "flashcards_50") {
      earned = newFlashcards >= 50;
    } else if (badgeId === "flashcards_200") {
      earned = newFlashcards >= 200;
    } else if (badgeId === "flashcards_500") {
      earned = newFlashcards >= 500;
    } else if (badgeId === "flashcards_1000") {
      earned = newFlashcards >= 1000;
    } else if (badgeId === "quiz_perfect") {
      earned = event.type === "quiz" && event.score === event.total;
    } else if (badgeId === "quiz_5_90" || badgeId === "quiz_10_90") {
      const { data: quizzes } = await supabase
        .from("quiz_results")
        .select("score, total")
        .eq("user_id", userId)
        .not("score", "is", null);
      const count = (quizzes ?? []).filter((q: { score: number; total: number }) => q.total > 0 && q.score / q.total >= 0.9).length;
      earned = count >= (badgeId === "quiz_5_90" ? 5 : 10);
    } else if (badgeId === "quiz_20_any") {
      const { count: quizCount } = await supabase
        .from("quiz_results")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("score", "is", null);
      earned = (quizCount ?? 0) >= 20;
    } else if (badgeId === "level_advanced") {
      earned = event.type === "message" && event.detectedLevel === "advanced";
    } else if (badgeId === "tier_silver") {
      earned = (prevXp + xpGained) >= 700;
    } else if (badgeId === "tier_gold") {
      earned = (prevXp + xpGained) >= 2500;
    } else if (badgeId === "tier_platinum") {
      earned = (prevXp + xpGained) >= 6000;
    } else if (badgeId === "tier_diamond") {
      earned = (prevXp + xpGained) >= 13000;
    } else if (badgeId === "tier_legend") {
      earned = (prevXp + xpGained) >= 25000;
    } else if (badgeId.startsWith("trail_")) {
      const level = badgeId.replace("trail_", "").toUpperCase();
      const levelSteps = TRAIL_STEPS.filter((s) => s.level === level);
      if (levelSteps.length > 0) {
        const { data: completed } = await supabase
          .from("learning_path_progress")
          .select("step_id")
          .eq("user_id", userId);
        const completedSet = new Set((completed ?? []).map((c: { step_id: string }) => c.step_id));
        // Include the current step
        if (event.type === "trail_step") completedSet.add(event.stepId);
        earned = levelSteps.every((s) => completedSet.has(s.id));
      }
    } else if (badgeId === "app_installed") {
      earned = event.type === "app_installed";
    }

    if (earned) {
      await supabase.from("user_badges").insert({ user_id: userId, badge_id: badgeId });
      bonusXp += badge.xpReward;
      newBadges.push(badge);
    }
  }

  const finalXp = prevXp + xpGained + bonusXp;

  await supabase.from("user_xp").upsert(
    {
      user_id: userId,
      total_xp: finalXp,
      message_count: newMessages,
      flashcard_reviews: newFlashcards,
      updated_at: new Date().toISOString(),
      ...(displayName ? { display_name: displayName } : {}),
    },
    { onConflict: "user_id" }
  );

  return { newXp: finalXp, newBadges };
}
