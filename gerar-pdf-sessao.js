const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const doc = new PDFDocument({ margin: 50, size: "A4" });
const out = path.join(__dirname, "Sessao-Coach-IA.pdf");
doc.pipe(fs.createWriteStream(out));

const YELLOW = "#F5C800";
const BLACK = "#0a0a0a";
const DARK = "#1a1a1a";
const GRAY = "#888888";
const WHITE = "#ffffff";
const GREEN = "#4ade80";
const RED = "#f87171";

// ── Background ──────────────────────────────────────────────────────────────
doc.rect(0, 0, doc.page.width, doc.page.height).fill(BLACK);

// ── Header ──────────────────────────────────────────────────────────────────
doc.rect(0, 0, doc.page.width, 90).fill(DARK);

doc.rect(50, 22, 46, 46).fill(YELLOW);
doc.fontSize(18).font("Helvetica-Bold").fillColor(BLACK).text("JV", 50, 34, { width: 46, align: "center" });

doc.fontSize(20).font("Helvetica-Bold").fillColor(WHITE).text("Fale Inglês ", 110, 28, { continued: true });
doc.fillColor(YELLOW).text("JV");
doc.fontSize(11).font("Helvetica").fillColor(GRAY).text("Coach IA — Relatório de Sessão", 110, 52);

doc.fontSize(10).font("Helvetica").fillColor(GRAY).text("08/06/2026", 0, 38, { align: "right" });

// ── Title ────────────────────────────────────────────────────────────────────
doc.moveDown(3.5);
doc.fontSize(22).font("Helvetica-Bold").fillColor(YELLOW).text("O que foi feito nessa sessão", 50);
doc.fontSize(12).font("Helvetica").fillColor(GRAY).text("6 commits enviados — itens para testar amanhã", 50);
doc.moveDown(1.2);

// ── Helper functions ─────────────────────────────────────────────────────────
function sectionTitle(num, title) {
  doc.rect(50, doc.y, doc.page.width - 100, 32).fill(DARK);
  const y = doc.y + 8;
  doc.rect(50, doc.y - 32 + 8, 4, 32).fill(YELLOW);
  doc.fontSize(13).font("Helvetica-Bold").fillColor(YELLOW).text(`${num}.`, 62, y, { continued: true });
  doc.fillColor(WHITE).text(` ${title}`);
  doc.moveDown(0.5);
}

function item(emoji, text, sub) {
  doc.fontSize(11).font("Helvetica").fillColor(WHITE).text(`  ${emoji}  ${text}`, 58, doc.y, { lineGap: 2 });
  if (sub) {
    doc.fontSize(9.5).fillColor(GRAY).text(`       ${sub}`, 58, doc.y, { lineGap: 2 });
  }
  doc.moveDown(0.3);
}

function testBox(label, steps) {
  doc.rect(58, doc.y, doc.page.width - 116, 14 + steps.length * 18).fill("#111111");
  doc.rect(58, doc.y, 3, 14 + steps.length * 18).fill(YELLOW);
  doc.fontSize(9).font("Helvetica-Bold").fillColor(YELLOW).text("  COMO TESTAR", 70, doc.y + 4);
  doc.moveDown(0.6);
  steps.forEach((s, i) => {
    doc.fontSize(9).font("Helvetica").fillColor(GRAY).text(`  ${i + 1}.  ${s}`, 70, doc.y, { lineGap: 1 });
    doc.moveDown(0.2);
  });
  doc.moveDown(0.6);
}

function pendingBox(text) {
  doc.rect(58, doc.y, doc.page.width - 116, 28).fill("#1a0a00");
  doc.rect(58, doc.y, 3, 28).fill(RED);
  doc.fontSize(9).font("Helvetica-Bold").fillColor(RED).text("  ⚠️  PENDENTE DE CONFIGURAÇÃO", 70, doc.y + 4);
  doc.fontSize(9).font("Helvetica").fillColor("#ffaa88").text(`  ${text}`, 70, doc.y + 2);
  doc.moveDown(1.2);
}

// ── 1. Dashboard de Progresso ────────────────────────────────────────────────
sectionTitle("1", "Dashboard de Progresso  (/app/historico)");
item("🔥", "Streak de dias consecutivos");
item("📊", "Média geral, melhor resultado, nível dominante");
item("📈", "Gráfico SVG dos últimos 10 quizzes com tendência ↑↓");
testBox("", [
  "Acesse www.faleinglesjv.com/app → clique em 🏆 Histórico",
  "Verifique os cards: streak, média, melhor resultado, nível",
  "Se tiver quizzes feitos, o gráfico de evolução deve aparecer",
]);

// ── 2. Tópicos Guiados ───────────────────────────────────────────────────────
sectionTitle("2", "Tópicos Guiados");
item("💬", "Tela de seleção com 8 módulos ao abrir o app");
item("🤖", "Coach abre a conversa automaticamente por tópico", "Cada módulo tem vocabulário e frases específicas no system prompt");
item("🏷️", "Pill do tópico ativo no header + botão Trocar tópico");
testBox("", [
  "Acesse /app → deve aparecer a tela de seleção de tópicos",
  "Toque em 'Trabalho & Carreira' → Coach deve abrir em inglês sobre trabalho",
  "Toque em 'Phrasal Verbs' → Coach deve usar phrasal verbs na conversa",
  "Verifique pill do tópico ativo no topo do chat",
  "Clique 'Trocar tópico' → volta para a seleção",
]);

// ── 3. Welcome Email + Streak Reminder ──────────────────────────────────────
doc.addPage();
doc.rect(0, 0, doc.page.width, doc.page.height).fill(BLACK);

sectionTitle("3", "Welcome Email + Lembrete de Streak");
item("📧", "Email de boas-vindas ao criar conta", "Com grid dos 8 tópicos + botão CTA");
item("🔔", "Cron diário às 19h BRT", "Envia email para alunos com streak em risco (praticou ontem, não hoje)");
item("📱", "Notificação no seu WhatsApp em ambos os casos");
pendingBox("Resend (RESEND_API_KEY) + Clerk Webhook (CLERK_WEBHOOK_SECRET) + 2 colunas no Supabase");
testBox("Após configurar Resend e Clerk:", [
  "Crie uma conta nova no site → aguarde o email de boas-vindas",
  "Verifique o WhatsApp: deve chegar '👤 Novo cadastro'",
  "Para testar o cron: acesse /api/cron/streak no navegador (logado como admin)",
]);

// ── 4. Header Responsivo ─────────────────────────────────────────────────────
sectionTitle("4", "Header Responsivo");
item("📱", "Mobile: só o badge JV amarelo (sem texto 'Fale Inglês JV')");
item("🖥️", "Desktop: 👤 Portal do Aluno (Pro) + 🏆 Histórico com texto");
item("👤", "Portal do Aluno → abre Stripe para gerenciar/cancelar assinatura", "Visível apenas para usuários Pro");
testBox("", [
  "No celular: verifique que o header mostra só o badge JV + ícones",
  "No desktop: verifique 'Portal do Aluno' e 'Histórico' com texto",
  "Como Pro: clique 'Portal do Aluno' → deve abrir o portal do Stripe",
]);

// ── 5. PWA ───────────────────────────────────────────────────────────────────
sectionTitle("5", "PWA — Instalável no Celular");
item("📲", "Android (Chrome): banner automático 'Adicionar à tela inicial'");
item("🍎", "iOS (Safari): compartilhar ⬆️ → 'Adicionar à Tela de Início'");
item("🖥️", "Desktop: ícone de instalação na barra do Chrome/Edge");
item("🎨", "Abre no /app sem barra do navegador, barra de status amarela");
testBox("", [
  "Android: abra Chrome → faleinglesjv.com → aguarde banner ou menu ⋮ → Instalar",
  "iOS: abra Safari → faleinglesjv.com → ⬆️ → Adicionar à Tela de Início",
  "Nome deve aparecer como 'JV IA', ícone amarelo com JV",
  "Ao abrir o app instalado: deve abrir direto no /app sem barra do browser",
]);

// ── Pendências gerais ────────────────────────────────────────────────────────
doc.moveDown(0.5);
doc.rect(50, doc.y, doc.page.width - 100, 1).fill(DARK);
doc.moveDown(0.8);

doc.fontSize(13).font("Helvetica-Bold").fillColor(YELLOW).text("Configurações pendentes (você faz, não é código)", 50);
doc.moveDown(0.5);

function pendingItem(n, title, desc) {
  doc.fontSize(11).font("Helvetica-Bold").fillColor(WHITE).text(`  ${n}. ${title}`, 58);
  doc.fontSize(9.5).font("Helvetica").fillColor(GRAY).text(`     ${desc}`, 58);
  doc.moveDown(0.4);
}

pendingItem("1", "Resend", "resend.com → criar conta → verificar domínio faleinglesjv.com → adicionar RESEND_API_KEY no Vercel");
pendingItem("2", "Clerk Webhook", "dashboard.clerk.com → Webhooks → Add Endpoint → faleinglesjv.com/api/clerk-webhook → evento user.created → adicionar CLERK_WEBHOOK_SECRET no Vercel");
pendingItem("3", "Supabase SQL", "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS email text;\nALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS name text;");

// ── Footer ───────────────────────────────────────────────────────────────────
const footerY = doc.page.height - 40;
doc.rect(0, footerY - 10, doc.page.width, 50).fill(DARK);
doc.fontSize(9).font("Helvetica").fillColor(GRAY)
  .text("Fale Inglês JV · faleinglesjv.com · Coach IA", 50, footerY, { align: "center" });

doc.end();
console.log("✅ PDF gerado:", out);
