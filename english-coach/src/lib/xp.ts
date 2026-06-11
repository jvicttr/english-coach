import { createClient } from "@supabase/supabase-js";
import { TRAIL_STEPS } from "./trilha-steps";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

export type BadgeId =
  | "first_message" | "messages_100" | "messages_500"
  | "streak_7" | "streak_30"
  | "flashcards_50" | "flashcards_200"
  | "quiz_perfect" | "quiz_5_90"
  | "trail_a1" | "trail_a2" | "trail_b1" | "trail_b2" | "trail_c1"
  | "level_advanced";

export type Badge = {
  id: BadgeId;
  emoji: string;
  title: string;
  desc: string;
  xpReward: number;
};

export const BADGES: Badge[] = [
  { id: "first_message",  emoji: "💬", title: "Primeira Conversa",  desc: "Enviou sua primeira mensagem em inglês",        xpReward: 10  },
  { id: "messages_100",   emoji: "💪", title: "Falante Ativo",      desc: "100 mensagens enviadas",                        xpReward: 30  },
  { id: "messages_500",   emoji: "🗣️", title: "Conversador Nato",   desc: "500 mensagens enviadas",                        xpReward: 100 },
  { id: "streak_7",       emoji: "🔥", title: "Semana de Fogo",     desc: "7 dias seguidos praticando",                    xpReward: 50  },
  { id: "streak_30",      emoji: "⚡", title: "Mês Dedicado",       desc: "30 dias seguidos praticando",                   xpReward: 200 },
  { id: "flashcards_50",  emoji: "🃏", title: "Estudante",          desc: "50 flashcards revisados",                       xpReward: 30  },
  { id: "flashcards_200", emoji: "📚", title: "Vocabulário Rico",   desc: "200 flashcards revisados",                      xpReward: 100 },
  { id: "quiz_perfect",   emoji: "⭐", title: "Quiz Perfeito",      desc: "100% de acerto em um quiz",                     xpReward: 50  },
  { id: "quiz_5_90",      emoji: "🎯", title: "Consistente",        desc: "5 quizzes com 90% ou mais",                     xpReward: 80  },
  { id: "trail_a1",       emoji: "🌱", title: "A1 Completo",        desc: "Concluiu todas as etapas do nível A1",          xpReward: 100 },
  { id: "trail_a2",       emoji: "🌿", title: "A2 Completo",        desc: "Concluiu todas as etapas do nível A2",          xpReward: 150 },
  { id: "trail_b1",       emoji: "🌳", title: "B1 Completo",        desc: "Concluiu todas as etapas do nível B1",          xpReward: 200 },
  { id: "trail_b2",       emoji: "🦅", title: "B2 Completo",        desc: "Concluiu todas as etapas do nível B2",          xpReward: 250 },
  { id: "trail_c1",       emoji: "👑", title: "Maestria",           desc: "Concluiu todas as etapas do nível C1",          xpReward: 500 },
  { id: "level_advanced", emoji: "🚀", title: "Nível Avançado",     desc: "Atingiu o nível avançado detectado pelo coach", xpReward: 100 },
];

export const TIERS = [
  { id: "bronze", label: "Bronze", emoji: "🥉", color: "#cd7f32", min: 0,    max: 499  },
  { id: "silver", label: "Prata",  emoji: "🥈", color: "#b0b0b0", min: 500,  max: 1999 },
  { id: "gold",   label: "Ouro",   emoji: "🥇", color: "#F5C800", min: 2000, max: Infinity },
] as const;

export function getTier(xp: number) {
  return TIERS.find((t) => xp >= t.min && xp <= t.max) ?? TIERS[0];
}

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
  | { type: "trail_step"; stepId: string };

export async function grantXP(userId: string, event: XPEvent): Promise<{ newXp: number; newBadges: Badge[] }> {
  // Get current state
  const { data: current } = await supabase
    .from("user_xp")
    .select("total_xp, message_count, flashcard_reviews")
    .eq("user_id", userId)
    .single();

  const prevXp = current?.total_xp ?? 0;
  const prevMessages = current?.message_count ?? 0;
  const prevFlashcards = current?.flashcard_reviews ?? 0;

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
    if (event.detectedLevel === "advanced") badgesToCheck.push("level_advanced");
    badgesToCheck.push("streak_7", "streak_30");
  } else if (event.type === "quiz") {
    if (event.score === event.total) badgesToCheck.push("quiz_perfect");
    badgesToCheck.push("quiz_5_90");
  } else if (event.type === "flashcard") {
    if (newFlashcards >= 50) badgesToCheck.push("flashcards_50");
    if (newFlashcards >= 200) badgesToCheck.push("flashcards_200");
  } else if (event.type === "trail_step") {
    const step = TRAIL_STEPS.find((s) => s.id === event.stepId);
    if (step) {
      badgesToCheck.push(`trail_${step.level.toLowerCase()}` as BadgeId);
    }
  }

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
    } else if (badgeId === "streak_7" || badgeId === "streak_30") {
      const streak = await getCurrentStreak(userId);
      earned = streak >= (badgeId === "streak_7" ? 7 : 30);
    } else if (badgeId === "flashcards_50") {
      earned = newFlashcards >= 50;
    } else if (badgeId === "flashcards_200") {
      earned = newFlashcards >= 200;
    } else if (badgeId === "quiz_perfect") {
      earned = event.type === "quiz" && event.score === event.total;
    } else if (badgeId === "quiz_5_90") {
      const { data: quizzes } = await supabase
        .from("quiz_results")
        .select("score, total")
        .eq("user_id", userId)
        .not("score", "is", null);
      const count = (quizzes ?? []).filter((q: { score: number; total: number }) => q.total > 0 && q.score / q.total >= 0.9).length;
      earned = count >= 5;
    } else if (badgeId === "level_advanced") {
      earned = event.type === "message" && event.detectedLevel === "advanced";
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
    }

    if (earned) {
      await supabase.from("user_badges").insert({ user_id: userId, badge_id: badgeId });
      bonusXp += badge.xpReward;
      newBadges.push(badge);
    }
  }

  const finalXp = prevXp + xpGained + bonusXp;

  await supabase.from("user_xp").upsert(
    { user_id: userId, total_xp: finalXp, message_count: newMessages, flashcard_reviews: newFlashcards, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );

  return { newXp: finalXp, newBadges };
}
