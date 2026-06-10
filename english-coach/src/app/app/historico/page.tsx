"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Historico() {
  const router = useRouter();
  useEffect(() => { router.replace("/app/progresso"); }, [router]);
  return null;
}
