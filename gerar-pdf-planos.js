const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 50, bottom: 50, left: 50, right: 50 },
});

const output = path.join(__dirname, 'Planos-Fale-Inglês-JV.pdf');
doc.pipe(fs.createWriteStream(output));

const BLACK = '#111111';
const YELLOW = '#F5C800';
const WHITE = '#FFFFFF';
const GRAY = '#888888';
const DARK = '#1A1A1A';
const DARK2 = '#222222';

const W = 595 - 100; // page width minus margins

// ── Background ───────────────────────────────────────────────
doc.rect(0, 0, 595, 842).fill(BLACK);

// ── Header ───────────────────────────────────────────────────
doc.rect(50, 50, W, 80).fill(DARK);

doc.fontSize(22).fillColor(YELLOW).font('Helvetica-Bold')
  .text('Fale Inglês JV', 50, 66, { width: W, align: 'center' });

doc.fontSize(11).fillColor(WHITE).font('Helvetica')
  .text('Planos de Aulas Particulares + Coach IA', 50, 94, { width: W, align: 'center' });

// ── Subtitle chip ─────────────────────────────────────────────
doc.roundedRect(195, 148, 205, 22, 11).fill(YELLOW);
doc.fontSize(9).fillColor(BLACK).font('Helvetica-Bold')
  .text('Coach IA com 50% de desconto', 195, 154, { width: 205, align: 'center' });

doc.fontSize(10).fillColor(GRAY).font('Helvetica')
  .text('Pratique inglês com a IA entre as suas aulas — a qualquer hora, sem limite.', 50, 180, { width: W, align: 'center' });

// ═══════════════════════════════════════════════════════════════
// ── SECTION: MENSAL ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
let y = 210;

doc.fontSize(13).fillColor(YELLOW).font('Helvetica-Bold')
  .text('MENSAL', 50, y);
doc.moveTo(50, y + 18).lineTo(545, y + 18).stroke(YELLOW);
y += 28;

const mensalPlanos = [
  { freq: '1x por semana', aulas: '4 aulas/mês',  aula: 'R$ 259,90', coach: 'R$ 48,50', total: 'R$ 308,40' },
  { freq: '2x por semana', aulas: '8 aulas/mês',  aula: 'R$ 359,90', coach: 'R$ 48,50', total: 'R$ 408,40' },
  { freq: '3x por semana', aulas: '12 aulas/mês', aula: 'R$ 459,90', coach: 'R$ 48,50', total: 'R$ 508,40' },
];

// Table header
doc.rect(50, y, W, 24).fill(DARK2);
doc.fontSize(9).fillColor(YELLOW).font('Helvetica-Bold');
doc.text('Frequência',    55,  y + 8, { width: 110 });
doc.text('Aulas/mês',    165,  y + 8, { width: 80, align: 'center' });
doc.text('Valor aulas',  245,  y + 8, { width: 90, align: 'center' });
doc.text('+ Coach IA',   335,  y + 8, { width: 90, align: 'center' });
doc.text('Total/mês',    425,  y + 8, { width: 120, align: 'center' });
y += 24;

mensalPlanos.forEach((p, i) => {
  const bg = i % 2 === 0 ? '#181818' : '#141414';
  doc.rect(50, y, W, 30).fill(bg);

  doc.fontSize(10).fillColor(WHITE).font('Helvetica-Bold')
    .text(p.freq, 55, y + 10, { width: 110 });
  doc.fillColor(GRAY).font('Helvetica')
    .text(p.aulas, 165, y + 10, { width: 80, align: 'center' });
  doc.fillColor(WHITE)
    .text(p.aula, 245, y + 10, { width: 90, align: 'center' });
  doc.fillColor(YELLOW)
    .text(p.coach, 335, y + 10, { width: 90, align: 'center' });

  // Total box
  doc.rect(425, y + 4, 118, 22).fill(YELLOW);
  doc.fontSize(10).fillColor(BLACK).font('Helvetica-Bold')
    .text(p.total, 425, y + 9, { width: 118, align: 'center' });

  y += 30;
});

// Coach note
doc.rect(50, y, W, 20).fill('#1C1C00');
doc.fontSize(8).fillColor(YELLOW).font('Helvetica')
  .text('* Coach IA: de R$ 97,00 por R$ 48,50/mês — 50% de desconto exclusivo para alunos.', 55, y + 6, { width: W - 10 });
y += 32;

// ═══════════════════════════════════════════════════════════════
// ── SECTION: SEMESTRAL ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
doc.fontSize(13).fillColor(YELLOW).font('Helvetica-Bold')
  .text('SEMESTRAL', 50, y);
doc.moveTo(50, y + 18).lineTo(545, y + 18).stroke(YELLOW);
y += 28;

const semestralPlanos = [
  { freq: '1x por semana', aulas: '4 aulas/mês',  parcela: 'R$ 200,00', coach: 'R$ 48,50', total: '6x de R$ 248,50' },
  { freq: '2x por semana', aulas: '8 aulas/mês',  parcela: 'R$ 300,00', coach: 'R$ 48,50', total: '6x de R$ 348,50' },
  { freq: '3x por semana', aulas: '12 aulas/mês', parcela: 'R$ 400,00', coach: 'R$ 48,50', total: '6x de R$ 448,50' },
];

// Table header
doc.rect(50, y, W, 24).fill(DARK2);
doc.fontSize(9).fillColor(YELLOW).font('Helvetica-Bold');
doc.text('Frequência',    55,  y + 8, { width: 110 });
doc.text('Aulas/mês',    165,  y + 8, { width: 80, align: 'center' });
doc.text('Parcela aulas', 245, y + 8, { width: 90, align: 'center' });
doc.text('+ Coach IA',   335,  y + 8, { width: 90, align: 'center' });
doc.text('Total parcela', 425, y + 8, { width: 120, align: 'center' });
y += 24;

semestralPlanos.forEach((p, i) => {
  const bg = i % 2 === 0 ? '#181818' : '#141414';
  doc.rect(50, y, W, 30).fill(bg);

  doc.fontSize(10).fillColor(WHITE).font('Helvetica-Bold')
    .text(p.freq, 55, y + 10, { width: 110 });
  doc.fillColor(GRAY).font('Helvetica')
    .text(p.aulas, 165, y + 10, { width: 80, align: 'center' });
  doc.fillColor(WHITE)
    .text(p.parcela, 245, y + 10, { width: 90, align: 'center' });
  doc.fillColor(YELLOW)
    .text(p.coach, 335, y + 10, { width: 90, align: 'center' });

  // Total box
  doc.rect(425, y + 4, 118, 22).fill(YELLOW);
  doc.fontSize(9).fillColor(BLACK).font('Helvetica-Bold')
    .text(p.total, 425, y + 9, { width: 118, align: 'center' });

  y += 30;
});

// Saving note
doc.rect(50, y, W, 20).fill('#1C1C00');
doc.fontSize(8).fillColor(YELLOW).font('Helvetica')
  .text('* Semestral = 6 meses com desconto nas aulas + Coach IA incluso. Pague no cartão de crédito.', 55, y + 6, { width: W - 10 });
y += 36;

// ── O que inclui ─────────────────────────────────────────────
doc.rect(50, y, W, 110).fill(DARK);
doc.rect(50, y, 4, 110).fill(YELLOW); // left accent bar

doc.fontSize(11).fillColor(YELLOW).font('Helvetica-Bold')
  .text('O que está incluso no Coach IA:', 62, y + 14);

const items = [
  'Conversas ilimitadas em inglês com o coach de IA',
  'Respostas em áudio para treinar o listening',
  'Correções automáticas de gramática e pronúncia',
  'Disponível 24h por dia, 7 dias por semana',
];

items.forEach((item, i) => {
  doc.fontSize(9.5).fillColor(WHITE).font('Helvetica')
    .text(`✓  ${item}`, 62, y + 34 + i * 17);
});

y += 124;

// ── Footer ────────────────────────────────────────────────────
doc.rect(50, y, W, 1).fill('#333333');
y += 12;

doc.fontSize(9).fillColor(GRAY).font('Helvetica')
  .text('faleinglesjv.com  ·  WhatsApp: (61) 99569-1219  ·  Pagamento seguro via Stripe  ·  Cancele quando quiser', 50, y, { width: W, align: 'center' });

doc.end();
console.log(`PDF gerado: ${output}`);
