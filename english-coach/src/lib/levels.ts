export type LevelId = "iniciante" | "basico" | "intermediario" | "avancado";

export const LEVEL_OPTIONS: { id: LevelId; emoji: string; label: string; desc: string; color: string }[] = [
  {
    id: "iniciante",
    emoji: "🌱",
    label: "Iniciante",
    desc: "Sei pouquíssimo ou nada de inglês",
    color: "#4ade80",
  },
  {
    id: "basico",
    emoji: "📖",
    label: "Básico",
    desc: "Conheço o básico mas tenho dificuldade",
    color: "#60a5fa",
  },
  {
    id: "intermediario",
    emoji: "💬",
    label: "Intermediário",
    desc: "Consigo me comunicar mas quero melhorar",
    color: "#f59e0b",
  },
  {
    id: "avancado",
    emoji: "🚀",
    label: "Avançado",
    desc: "Já falo bem e quero aprimorar",
    color: "#a78bfa",
  },
];

// Nível usado pelo chat/roleplay/quiz/flashcards — cada um dos 4 níveis do
// perfil tem seu próprio valor distinto, nenhum colapsa em outro.
export const LEVEL_TO_CHAT_LEVEL: Record<LevelId, "beginner" | "elementary" | "intermediate" | "advanced"> = {
  iniciante: "beginner",
  basico: "elementary",
  intermediario: "intermediate",
  avancado: "advanced",
};
