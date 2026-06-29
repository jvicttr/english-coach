export const TIERS = [
  { id: "bronze",   label: "Bronze",   emoji: "🥉", color: "#cd7f32", min: 0,      max: 699,      desc: "Primeiros passos — cumprimentos, rotina, vocabulário de sobrevivência (A1)"      },
  { id: "silver",   label: "Prata",    emoji: "🥈", color: "#b0b0b0", min: 700,    max: 2499,     desc: "Comunicação básica — passado, futuro, tópicos do dia a dia (A2)"                },
  { id: "gold",     label: "Ouro",     emoji: "🥇", color: "#F5C800", min: 2500,   max: 5999,     desc: "Conversas fluentes — opiniões, phrasal verbs, situações de trabalho (B1)"       },
  { id: "platinum", label: "Platina",  emoji: "💎", color: "#e2e8f0", min: 6000,   max: 12999,    desc: "Discussões complexas — idioms, condicionais, vocabulário rico (B2)"             },
  { id: "diamond",  label: "Diamante", emoji: "💠", color: "#67e8f9", min: 13000,  max: 24999,    desc: "Quase nativo — nuances, humor, expressões culturais avançadas (C1)"             },
  { id: "legend",   label: "Lenda",    emoji: "👑", color: "#a78bfa", min: 25000,  max: Infinity, desc: "Maestria total — fluência nativa, referências culturais profundas (C2)"         },
] as const;

export type Tier = typeof TIERS[number];

export function getTier(xp: number): Tier {
  return TIERS.find((t) => xp >= t.min && xp <= t.max) ?? TIERS[0];
}
