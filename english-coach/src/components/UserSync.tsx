"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";

export function UserSync() {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded || !user) return;

    // Sincronizar usuário com o banco de dados
    fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: user.primaryEmailAddress?.emailAddress || user.username || user.id,
        name: user.fullName || user.username || user.id,
        image: user.hasImage ? user.imageUrl : null,
      }),
    }).catch((error) => console.error("Erro ao sincronizar usuário:", error));
  }, [user, isLoaded]);

  return null;
}
