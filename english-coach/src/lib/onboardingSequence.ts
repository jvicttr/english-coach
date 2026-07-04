"use client";

// Coordena a ordem de exibição dos modais na primeira abertura do app:
// o pop-up de notificação resolve (mostrado e fechado, ou nem precisou mostrar)
// antes do tour de boas-vindas aparecer, evitando os dois disputarem a tela.

let resolveFlow: (() => void) | null = null;
let resolved = false;

export const notifFlowDone: Promise<void> = new Promise((resolve) => {
  resolveFlow = resolve;
});

export function markNotifFlowDone() {
  if (resolved) return;
  resolved = true;
  resolveFlow?.();
}
