/* PDF da ata com o MESMO visual da tela: captura o painel em alta
   resolução (2x) e pagina em A4. A quebra de página acontece apenas
   entre cartões/seções — nunca no meio de um. Para o papel, o painel
   vira coluna única e nenhum texto fica cortado com "…".
   Bibliotecas carregadas sob demanda. */

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

  const SCALE = 2;
  const cutsPx = []; // topos dos cartões (px, relativos ao topo do elemento) = pontos seguros de corte
  const canvas = await html2canvas(element, {
    scale: SCALE,
    useCORS: true,
    backgroundColor: "#EDEFF2",
    windowWidth: Math.max(element.scrollWidth, 900),
    onclone: (doc, el) => {
      /* o clone interno recarrega o CSS pela rede; se o app está aberto
         desde antes de um deploy, o arquivo antigo já sumiu do servidor
         (404) e a captura sai sem estilo nenhum. Injetamos as regras da
         página viva direto no clone — sem depender de rede. */
      let css = "";
      Array.from(document.styleSheets).forEach((sheet) => {
        try { Array.from(sheet.cssRules).forEach((r) => { css += r.cssText + "\n"; }); } catch (e) {}
      });
      if (css) {
        doc.querySelectorAll('link[rel="stylesheet"]').forEach((n) => n.remove());
        const st = doc.createElement("style");
        st.textContent = css;
        doc.head.appendChild(st);
      }
      // no papel: coluna única e sem textos cortados com "…"
      el.querySelectorAll('[class*="columns-2"]').forEach((n) => { n.style.columnCount = "1"; });
      el.querySelectorAll(".truncate").forEach((n) => {
        n.classList.remove("truncate");
        n.style.whiteSpace = "normal";
        n.style.overflow = "visible";
      });
      const base = el.getBoundingClientRect().top;
      const marca = (n) => cutsPx.push(n.getBoundingClientRect().top - base);
      el.querySelectorAll(".break-inside-avoid, .grid, .mb-4").forEach(marca);
      Array.from(el.children).forEach(marca);
    },
  });

  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const M = 6;                       // margem
  const pw = 210 - 2 * M;            // largura útil
  const ph = 297 - 2 * M;            // altura útil por página
  const cssW = canvas.width / SCALE;
  const ih = (canvas.height * pw) / canvas.width; // altura total da imagem em mm
  const img = canvas.toDataURL("image/jpeg", 0.92);
  const cuts = [...new Set(cutsPx.map((px) => (px * pw) / cssW))].sort((a, b) => a - b);

  let y0 = 0;
  let primeira = true;
  while (y0 < ih - 0.5) {
    let end = Math.min(y0 + ph, ih);
    if (end < ih) {
      // recua até o início do último cartão que não coube inteiro,
      // desde que a página não fique curta demais (cartão gigante)
      const cand = cuts.filter((c) => c > y0 + 30 && c <= end);
      if (cand.length) end = cand[cand.length - 1] - 1;
    }
    if (!primeira) pdf.addPage();
    pdf.setFillColor(237, 239, 242);
    pdf.rect(0, 0, 210, 297, "F");
    pdf.addImage(img, "JPEG", M, M - y0, pw, ih);
    // cobre o que vazou acima e abaixo da fatia desta página
    pdf.setFillColor(237, 239, 242);
    pdf.rect(0, 0, 210, M, "F");
    pdf.rect(0, M + (end - y0), 210, 297 - M - (end - y0), "F");
    primeira = false;
    y0 = end;
  }

  const slug = stripEmoji(titulo || "ata").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "ata";
  const dataSlug = (data || "").replace(/\//g, "-");
  pdf.save(`ata-${dataSlug}-${slug}.pdf`);
}
