/* PDF da ata com o MESMO visual da tela: captura o painel em alta
   resolução (2x) e pagina em A4. Bibliotecas carregadas sob demanda. */

const stripEmoji = (s) =>
  String(s || "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();

export async function ataToPdf({ element, titulo, data }) {
  if (!element) return;
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#EDEFF2",
    windowWidth: Math.max(element.scrollWidth, 900),
  });

  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const M = 6;                       // margem
  const pw = 210 - 2 * M;            // largura útil
  const ph = 297 - 2 * M;            // altura útil por página
  const ih = (canvas.height * pw) / canvas.width; // altura total da imagem em mm
  const img = canvas.toDataURL("image/jpeg", 0.92);

  let restante = ih;
  let offset = 0;
  let primeira = true;
  while (restante > 0) {
    if (!primeira) pdf.addPage();
    pdf.setFillColor(237, 239, 242);
    pdf.rect(0, 0, 210, 297, "F");
    pdf.addImage(img, "JPEG", M, M - offset, pw, ih);
    // cobre o que vazou para fora das margens desta página
    pdf.setFillColor(237, 239, 242);
    pdf.rect(0, 0, 210, M, "F");
    pdf.rect(0, 297 - M, 210, M, "F");
    primeira = false;
    offset += ph;
    restante -= ph;
  }

  const slug = stripEmoji(titulo || "ata").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "ata";
  const dataSlug = (data || "").replace(/\//g, "-");
  pdf.save(`ata-${dataSlug}-${slug}.pdf`);
}
