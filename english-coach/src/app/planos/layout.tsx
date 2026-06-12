import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Planos — Assine o JV IA",
  description: "Escolha o plano ideal para aprender inglês com o JV IA. Acesso ao coach de IA, trilha de aprendizado, flashcards e muito mais. Comece hoje.",
  alternates: {
    canonical: "/planos",
  },
  openGraph: {
    title: "Planos — Assine o JV IA",
    description: "Acesso ao coach de inglês com IA, trilha de aprendizado, flashcards e quizzes. Escolha seu plano.",
    url: "https://faleinglesjv.com/planos",
  },
};

export default function PlanosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
