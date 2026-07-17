// Client-side event bus used to notify the UI when the user's XP response
// includes a newly-earned tier badge, so a celebration modal can be shown
// regardless of which page/flow triggered the XP grant (chat, quiz, flashcards, trilha).
const EVENT_NAME = "fijv:tier-up";

const TIER_BADGE_ORDER = ["tier_silver", "tier_gold", "tier_platinum", "tier_diamond", "tier_legend"];

export function emitTierUp(newBadges?: { id: string }[] | null) {
  if (!newBadges || newBadges.length === 0) return;
  const tierBadges = newBadges.filter((b) => TIER_BADGE_ORDER.includes(b.id));
  if (tierBadges.length === 0) return;

  // If more than one tier was crossed in a single XP grant, celebrate the highest.
  const highest = tierBadges.sort(
    (a, b) => TIER_BADGE_ORDER.indexOf(a.id) - TIER_BADGE_ORDER.indexOf(b.id)
  ).pop()!;
  const tierId = highest.id.replace("tier_", "");

  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { tierId } }));
}

export function onTierUp(handler: (tierId: string) => void) {
  const listener = (e: Event) => handler((e as CustomEvent<{ tierId: string }>).detail.tierId);
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
