import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pdfBase64 } = await req.json();
  if (!pdfBase64) return NextResponse.json({ error: "No PDF provided" }, { status: 400 });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBase64,
            },
          },
          {
            type: "text",
            text: `Você é um assistente de revisão de aulas de inglês. Analise este material de aula e crie um resumo estruturado e organizado em português brasileiro.

O resumo deve conter:

1. **Tema principal da aula** — uma frase resumindo o foco central
2. **Estruturas gramaticais estudadas** — liste cada estrutura com uma breve explicação e exemplo da própria aula
3. **Vocabulário novo** — palavras ou expressões apresentadas, com tradução e exemplo de uso
4. **Expressões idiomáticas ou phrasal verbs** — se houver, com significado e exemplo
5. **Dicas práticas** — pontos de atenção mencionados na aula (pronúncia, uso, contexto)
6. **Como praticar** — 2 ou 3 sugestões curtas de como revisar e fixar o conteúdo dessa aula

Seja claro, direto e amigável. Use markdown para formatar (negrito, listas). O aluno vai usar isso para revisar o conteúdo nos dias entre as aulas.`,
          },
        ],
      },
    ],
  });

  const summary = response.content[0].type === "text" ? response.content[0].text : "";
  return NextResponse.json({ summary });
}
