import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "JV IA - Seu professor de inglês 24/7",
  description: "Pratique inglês com o JV IA: conversação guiada, trilha de aprendizado, flashcards com spaced repetition, quizzes e ranking. Seu professor de inglês disponível 24h.",
  alternates: {
    canonical: "/ia",
  },
  openGraph: {
    title: "JV IA - Seu professor de inglês 24/7",
    description: "Pratique inglês com conversação guiada, trilha de aprendizado, flashcards e quizzes. Disponível 24h.",
    url: "https://faleinglesjv.com/ia",
  },
};

export default function IaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
