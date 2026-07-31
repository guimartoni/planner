import { blocksToText } from "./lib/data.js";

/* Gera o PDF da ata (clássica ou de FUP). A biblioteca é carregada sob
   demanda para não pesar no carregamento normal do app. As fontes padrão
   do PDF não têm emoji, então os títulos são limpos antes de escrever. */

const stripEmoji = (s) =>
  String(s || "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{FE0F}\u{200D}\u{20E3}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();

export async function ataToPdf({ structured, tasks, blocks }) {
  const { jsPDF } = await import("jspdf");
  const s = structured || {};
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const VERDE = [30, 107, 79];
  const CINZA = [107, 114, 128];
  const PRETO = [31, 41, 55];
  const M = 18;                 // margem
  const W = 210 - 2 * M;        // largura útil
  const BOTTOM = 279;           // limite antes do rodapé
  let y = 0;

  const footer = () => {
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(...CINZA); doc.setFont("helvetica", "normal");
      doc.text("Planner — Gui · Finamob", M, 290);
      doc.text(`${i} / ${n}`, 210 - M, 290, { align: "right" });
    }
  };

  const breakIf = (need) => {
    if (y + need > BOTTOM) { doc.addPage(); y = M; }
  };

  const writeLines = (text, { size = 10, style = "normal", color = PRETO, indent = 0, lh = 4.8 } = {}) => {
    doc.setFontSize(size); doc.setFont("helvetica", style); doc.setTextColor(...color);
    const lines = doc.splitTextToSize(stripEmoji(text), W - indent);
    for (const ln of lines) {
      breakIf(lh);
      doc.text(ln, M + indent, y);
      y += lh;
    }
  };

  const section = (title) => {
    breakIf(14);
    y += 4;
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...VERDE);
    doc.text(stripEmoji(title).toUpperCase(), M, y);
    y += 1.6;
    doc.setDrawColor(...VERDE); doc.setLineWidth(0.3);
    doc.line(M, y, 210 - M, y);
    y += 4.6;
  };

  /* ---------- cabeçalho ---------- */
  doc.setFillColor(...VERDE);
  doc.rect(0, 0, 210, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text("ATA DE REUNIÃO", M, 11);
  doc.setFontSize(15); doc.setFont("helvetica", "bold");
  const tit = doc.splitTextToSize(stripEmoji(s.titulo || "Ata de reunião"), W);
  doc.text(tit[0] || "Ata de reunião", M, 19);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text(s.data || "", 210 - M, 11, { align: "right" });
  y = 34;

  /* ---------- seções ---------- */
  if ((s.participantes || []).length) {
    section("Participantes");
    writeLines(s.participantes.join("  ·  "));
  }
  if (s.resumo) {
    section("Resumo");
    writeLines(s.resumo);
  }
  if ((s.comparativo || []).length) {
    section("Comparativo com a semana anterior");
    s.comparativo.forEach((p) => writeLines(`•  ${p}`, { indent: 2 }));
  }
  if ((s.pauta || []).length) {
    section("Pauta");
    s.pauta.forEach((p) => writeLines(`•  ${p}`, { indent: 2 }));
  }
  if ((s.decisoes || []).length) {
    section("Decisões");
    s.decisoes.forEach((p) => writeLines(`•  ${p}`, { indent: 2 }));
  }
  if (blocks && blocks.length) {
    section("Dados da semana (FUP)");
    writeLines(blocksToText(blocks), { size: 9, color: [55, 65, 81], lh: 4.4 });
  }
  const acts = (tasks || []);
  if (acts.length) {
    section("Ações e responsáveis");
    acts.forEach((t) => {
      const extra = [t.userName ? `resp.: ${t.userName}` : "sem responsável", t.date ? `prazo: ${t.date}` : null]
        .filter(Boolean).join("  ·  ");
      writeLines(`•  ${t.important ? "[IMPORTANTE] " : ""}${t.text}`, { indent: 2 });
      writeLines(extra, { size: 8.5, color: CINZA, indent: 6, lh: 4.2 });
      y += 0.8;
    });
  }

  footer();

  const slug = stripEmoji(s.titulo || "ata").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "ata";
  const dataSlug = (s.data || "").replace(/\//g, "-");
  doc.save(`ata-${dataSlug}-${slug}.pdf`);
}
