export const TIERS = [
  { id: "bronze", label: "Bronze", emoji: "🥉", color: "#cd7f32", min: 0,    max: 499  },
  { id: "silver", label: "Prata",  emoji: "🥈", color: "#b0b0b0", min: 500,  max: 1999 },
  { id: "gold",   label: "Ouro",   emoji: "🥇", color: "#F5C800", min: 2000, max: Infinity },
] as const;

export type Tier = typeof TIERS[number];

export function getTier(xp: number): Tier {
  return TIERS.find((t) => xp >= t.min && xp <= t.max) ?? TIERS[0];
}
