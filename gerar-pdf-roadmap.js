const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 } });
const output = path.join(__dirname, 'Roadmap-Coach-IA.pdf');
doc.pipe(fs.createWriteStream(output));

const BLACK = '#111111';
const YELLOW = '#F5C800';
const WHITE = '#FFFFFF';
const GRAY = '#888888';
const DARK = '#1A1A1A';
const DARK2 = '#222222';
const RED = '#EF4444';
const AMBER = '#F59E0B';
const GREEN = '#22C55E';
const W = 495;

// Background
doc.rect(0, 0, 595, 842).fill(BLACK);

// Header
doc.rect(50, 50, W, 80).fill(DARK);
doc.fontSize(20).fillColor(YELLOW).font('Helvetica-Bold')
  .text('Coach IA — Fale Inglês JV', 50, 66, { width: W, align: 'center' });
doc.fontSize(11).fillColor(WHITE).font('Helvetica')
  .text('Próximos passos por prioridade', 50, 94, { width: W, align: 'center' });

let y = 155;

// ── Section builder ──────────────────────────────────────────────────────────
function section(label, color, dot, items) {
  // Section header
  doc.rect(50, y, W, 30).fill(DARK2);
  doc.rect(50, y, 5, 30).fill(color);

  // Dot + label
  doc.fontSize(14).fillColor(color).font('Helvetica-Bold')
    .text(`${dot}  ${label}`, 62, y + 8);

  y += 38;

  items.forEach((item) => {
    const titleH = 20;
    const descLines = item.desc.split('\n');
    const descH = descLines.length * 14 + 4;
    const cardH = titleH + descH + 20;

    doc.rect(50, y, W, cardH).fill('#161616');
    doc.rect(50, y, 3, cardH).fill(color);

    // Number badge
    doc.rect(60, y + 10, 24, 18).fill(color);
    doc.fontSize(10).fillColor(BLACK).font('Helvetica-Bold')
      .text(String(item.n), 60, y + 13, { width: 24, align: 'center' });

    // Title
    doc.fontSize(11).fillColor(WHITE).font('Helvetica-Bold')
      .text(item.title, 92, y + 11);

    // Description lines
    let dy = y + titleH + 8;
    descLines.forEach((line) => {
      doc.fontSize(9).fillColor(GRAY).font('Helvetica')
        .text(line, 92, dy, { width: W - 50 });
      dy += 14;
    });

    y += cardH + 8;
  });

  y += 8;
}

// ── Alta prioridade ───────────────────────────────────────────────────────────
section('Alta prioridade — impacto direto em vendas', RED, '🔴', [
  {
    n: 1, title: 'Landing page profissional',
    desc: 'A rota / vai direto para login/app. Sem uma página de vendas pública,\nnenhum link que você mandar converte. ✅ Feito nesta sessão.',
  },
  {
    n: 2, title: 'Portal do aluno para cancelar/gerenciar assinatura',
    desc: 'Hoje não existe. Se um aluno quiser cancelar, vai chamar no WhatsApp.\nO Stripe tem um portal pronto para integrar em ~20 minutos.',
  },
  {
    n: 3, title: 'Registro antes do link de desconto',
    desc: 'O link de desconto exige que o aluno já esteja cadastrado (userId).\nFluxo ideal: link → cadastro → desconto aplicado automaticamente.',
  },
]);

// ── Média prioridade ──────────────────────────────────────────────────────────
section('Média prioridade — retenção e engajamento', AMBER, '🟡', [
  {
    n: 4, title: 'Dashboard de progresso',
    desc: 'O aluno só vê histórico de quizzes. Falta gráfico de evolução,\nsequência de dias praticados (streak) e comparativo de nível.',
  },
  {
    n: 5, title: 'Tópicos guiados / planos de aula integrados',
    desc: 'O chat é livre hoje. Faltam módulos temáticos (trabalho, viagem,\nphrasal verbs) e conexão com os temas das aulas particulares.',
  },
  {
    n: 6, title: 'E-mail de boas-vindas / onboarding',
    desc: 'Novo aluno cadastra e não recebe nada. Falta instrução de como usar,\nlembrete para praticar e engajamento nos primeiros dias.',
  },
]);

// ── Menor prioridade ──────────────────────────────────────────────────────────
section('Menor prioridade — polimento', GREEN, '🟢', [
  {
    n: 7, title: 'PWA / instalável no celular',
    desc: 'Permitir que o aluno adicione o Coach IA à tela inicial do smartphone.',
  },
  {
    n: 8, title: 'Notificação de lembrete diário',
    desc: 'Push notification ou e-mail automático para lembrar de praticar.',
  },
  {
    n: 9, title: 'Feedback de pronúncia com pontuação',
    desc: 'Avaliar e pontuar a pronúncia do aluno a cada mensagem de voz.',
  },
]);

// Footer
doc.rect(50, y + 4, W, 1).fill('#2a2a2a');
doc.fontSize(8.5).fillColor(GRAY).font('Helvetica')
  .text('faleinglesjv.com  ·  Coach IA  ·  Gerado em junho de 2026', 50, y + 14, { width: W, align: 'center' });

doc.end();
console.log(`PDF gerado: ${output}`);
