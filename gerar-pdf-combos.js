const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 60, right: 60 } });
const output = path.join(__dirname, 'Combos-Fale-Ingles-JV.pdf');
doc.pipe(fs.createWriteStream(output));

const W = 595 - 120;

// ── Header ──────────────────────────────────────────────────────
doc.fontSize(20).fillColor('#000000').font('Helvetica-Bold')
  .text('Fale Inglês JV', 60, 50, { width: W, align: 'center' });

doc.fontSize(11).fillColor('#444444').font('Helvetica')
  .text('Aulas ao vivo + JV IA — Tabela de Preços', 60, 76, { width: W, align: 'center' });

doc.moveTo(60, 100).lineTo(535, 100).lineWidth(1).stroke('#cccccc');

// ── MENSAL ──────────────────────────────────────────────────────
let y = 118;

doc.fontSize(12).fillColor('#000000').font('Helvetica-Bold').text('MENSAL', 60, y);
y += 20;

// Header da tabela
doc.rect(60, y, W, 22).fill('#111111');
doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold');
doc.text('Frequência',       65, y + 7, { width: 120 });
doc.text('Aulas/mês',       185, y + 7, { width: 80, align: 'center' });
doc.text('Valor das aulas', 265, y + 7, { width: 100, align: 'center' });
doc.text('+ JV IA',         365, y + 7, { width: 80, align: 'center' });
doc.text('Total/mês',       445, y + 7, { width: 90, align: 'center' });
y += 22;

const mensal = [
  { freq: '1x por semana', aulas: '4 aulas/mês',  valor: 'R$ 259,90', ia: 'R$ 48,50', total: 'R$ 308,40/mês' },
  { freq: '2x por semana', aulas: '8 aulas/mês',  valor: 'R$ 359,90', ia: 'R$ 48,50', total: 'R$ 408,40/mês' },
  { freq: '3x por semana', aulas: '12 aulas/mês', valor: 'R$ 459,90', ia: 'R$ 48,50', total: 'R$ 508,40/mês' },
];

mensal.forEach((p, i) => {
  const bg = i % 2 === 0 ? '#f9f9f9' : '#ffffff';
  doc.rect(60, y, W, 28).fill(bg);
  doc.fontSize(10).fillColor('#000000').font('Helvetica-Bold').text(p.freq,  65, y + 9, { width: 120 });
  doc.fillColor('#666666').font('Helvetica').text(p.aulas,                  185, y + 9, { width: 80,  align: 'center' });
  doc.fillColor('#333333').text(p.valor,                                    265, y + 9, { width: 100, align: 'center' });
  doc.fillColor('#333333').text(p.ia,                                       365, y + 9, { width: 80,  align: 'center' });
  doc.fillColor('#000000').font('Helvetica-Bold').text(p.total,             445, y + 9, { width: 90,  align: 'center' });
  y += 28;
});

y += 24;

// ── SEMESTRAL ───────────────────────────────────────────────────
doc.fontSize(12).fillColor('#000000').font('Helvetica-Bold').text('SEMESTRAL', 60, y);
doc.fontSize(9).fillColor('#666666').font('Helvetica').text('-22% nas aulas', 60, y + 16);

y += 30;

// Header da tabela
doc.rect(60, y, W, 22).fill('#111111');
doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold');
doc.text('Frequência',        65, y + 7, { width: 120 });
doc.text('Aulas/mês',        185, y + 7, { width: 80, align: 'center' });
doc.text('Parcela das aulas', 265, y + 7, { width: 100, align: 'center' });
doc.text('+ JV IA',          365, y + 7, { width: 80, align: 'center' });
doc.text('Total da parcela',  445, y + 7, { width: 90, align: 'center' });
y += 22;

const semestral = [
  { freq: '1x por semana', aulas: '4 aulas/mês',  parcela: 'R$ 200,00', ia: 'R$ 48,50', total: '6x de R$ 248,50' },
  { freq: '2x por semana', aulas: '8 aulas/mês',  parcela: 'R$ 300,00', ia: 'R$ 48,50', total: '6x de R$ 348,50' },
  { freq: '3x por semana', aulas: '12 aulas/mês', parcela: 'R$ 400,00', ia: 'R$ 48,50', total: '6x de R$ 448,50' },
];

semestral.forEach((p, i) => {
  const bg = i % 2 === 0 ? '#f9f9f9' : '#ffffff';
  doc.rect(60, y, W, 28).fill(bg);
  doc.fontSize(10).fillColor('#000000').font('Helvetica-Bold').text(p.freq,   65, y + 9, { width: 120 });
  doc.fillColor('#666666').font('Helvetica').text(p.aulas,                   185, y + 9, { width: 80,  align: 'center' });
  doc.fillColor('#333333').text(p.parcela,                                   265, y + 9, { width: 100, align: 'center' });
  doc.fillColor('#333333').text(p.ia,                                        365, y + 9, { width: 80,  align: 'center' });
  doc.fillColor('#000000').font('Helvetica-Bold').text(p.total,              445, y + 9, { width: 90,  align: 'center' });
  y += 28;
});

y += 24;

// ── JV IA avulso ─────────────────────────────────────────────────
doc.rect(60, y, W, 28).fill('#f5f5f5');
doc.fontSize(10).fillColor('#000000').font('Helvetica-Bold')
  .text('JV IA avulso (sem aulas ao vivo):', 65, y + 9, { width: 260 });
doc.fillColor('#333333').font('Helvetica')
  .text('R$ 97,00/mês', 330, y + 9, { width: 150 });

y += 42;

// ── Notas ────────────────────────────────────────────────────────
doc.moveTo(60, y).lineTo(535, y).lineWidth(1).stroke('#cccccc');
y += 14;

doc.fontSize(8.5).fillColor('#555555').font('Helvetica')
  .text('• O JV IA (R$ 48,50/mês no combo) dá acesso ilimitado ao coach de IA: conversas, role-play, flashcards, trilha de estudos e mais. 50% de desconto exclusivo para alunos de aula ao vivo.', 60, y, { width: W, lineGap: 2 });
y += 22;
doc.text('• No semestral, o valor das aulas é parcelado em 6x no cartão de crédito. O JV IA é cobrado mensalmente à parte.', 60, y, { width: W, lineGap: 2 });

y += 40;

// ── Footer ───────────────────────────────────────────────────────
doc.moveTo(60, y).lineTo(535, y).lineWidth(0.5).stroke('#dddddd');
y += 12;
doc.fontSize(8).fillColor('#999999').font('Helvetica')
  .text('faleinglesjv.com  ·  WhatsApp: (61) 99569-1219', 60, y, { width: W, align: 'center' });

doc.end();
console.log('PDF gerado: ' + output);
