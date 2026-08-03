import { uid } from "./util.js";

/* Bloco do FUP de segunda com o Murilo — data + tema geral/outros assuntos */
export const FUP_MURILO_BLOCK = () => (
  { id: uid(), type: "fup", title: "🤝 FUP MURILO", date: "", text: "" }
);

export const FARMING_BLOCKS = () => ([
  { id: uid(), type: "list", title: "📍 VISITAS REALIZADAS NA SEMANA", rows: [] },
  { id: uid(), type: "table", title: "📅 VISITAS AGENDADAS", cols: ["Incorporadora", "Data", "Cidade/UF"], rows: [] },
  { id: uid(), type: "table", title: "🔜 VISITAS A AGENDAR", cols: ["Incorporadora", "Previsão", "Cidade/UF", "Observação"], rows: [] },
  { id: uid(), type: "table", title: "📞 CALLS DE PIPE REALIZADAS", cols: ["Incorporadora", "Nº operações", "Pendência"], rows: [] },
  { id: uid(), type: "table", title: "📞 CALLS DE PIPE A REALIZAR", cols: ["Incorporadora", "Observação"], rows: [] },
  { id: uid(), type: "sql", title: "💰 SQL — COMITÊ", comite: "", aprovados: [], ressalvados: [], reprovados: [] },
  { id: uid(), type: "table", title: "💰 SQL — A APRESENTAR", cols: ["Incorporadora", "Volume (M)"], rows: [] },
  { id: uid(), type: "text", title: "📌 TEMA GERAL / OUTROS ASSUNTOS", text: "" },
  FUP_MURILO_BLOCK(),
]);

/* Blocos da MIA (assistente de IA do Inbound): ajustes da semana + próximos passos */
export const MIA_BLOCKS = () => ([
  { id: uid(), type: "list", title: "🤖 MIA — AJUSTES FEITOS NA SEMANA", rows: [] },
  { id: uid(), type: "table", title: "🤖 MIA — PRÓXIMOS PASSOS", cols: ["Próximo passo", "Data estimada"], rows: [] },
]);

/* Consolidado do mês (Inbound): números somados de todos os FUPs do mês
   marcado no cabeçalho da página; recalculado sozinho ao abrir/editar. */
export const CONSOLIDADO_BLOCK = () => (
  { id: uid(), type: "consolidado", title: "📊 CONSOLIDADO DO MÊS", mes: "", vals: null }
);

/* Valor efetivo de um item do consolidado: o manual (✏️), se preenchido,
   senão o somado automaticamente. */
export const consolidadoEff = (b, k) => {
  const man = (b && b.manual) || {};
  if (man[k] !== undefined && String(man[k]).trim() !== "") {
    const m = String(man[k]).replace(",", ".").match(/[\d.]+/);
    return m ? parseFloat(m[0]) : 0;
  }
  return ((b && b.vals) || {})[k] || 0;
};

/* Bloco duplo de reuniões: agendadas e realizadas lado a lado */
export const REUNIOES_BLOCK = () => (
  { id: uid(), type: "reunioes", title: "🤝 REUNIÕES DA SEMANA", agendadas: "", realizadas: "" }
);

/* Migração: funde as métricas antigas (REUNIÕES DA SEMANA / AGENDADAS /
   REALIZADAS) num único bloco duplo, preservando os valores digitados. */
export function upgradeReunioes(blocks) {
  const src = blocks || [];
  const solta = (b) => b.type === "metric" && /REUNIÕES (AGENDADAS|REALIZADAS|DA SEMANA)/i.test(b.title || "");
  if (src.some((b) => b.type === "reunioes")) {
    const rest = src.filter((b) => !solta(b));
    return rest.length === src.length ? blocks : rest;
  }
  const iAg = src.findIndex((b) => b.type === "metric" && /REUNIÕES AGENDADAS/i.test(b.title || ""));
  const iRe = src.findIndex((b) => b.type === "metric" && /REUNIÕES (REALIZADAS|DA SEMANA)/i.test(b.title || ""));
  if (iAg < 0 && iRe < 0) return blocks;
  const dual = {
    id: uid(), type: "reunioes", title: "🤝 REUNIÕES DA SEMANA",
    agendadas: iAg >= 0 ? (src[iAg].value || "") : "",
    realizadas: iRe >= 0 ? (src[iRe].value || "") : "",
    comment: (iRe >= 0 && src[iRe].comment) || (iAg >= 0 && src[iAg].comment) || "",
  };
  const pos = [iAg, iRe].filter((x) => x >= 0).sort((a, b) => a - b)[0];
  const out = [];
  src.forEach((b, i) => {
    if (i === pos) out.push(dual);
    if (i === iAg || i === iRe) return;
    out.push(b);
  });
  return out;
}

/* Bloco duplo de leads: inbound e remarketing lado a lado */
export const LEADS_BLOCK = () => (
  { id: uid(), type: "leads", title: "📥 LEADS DA SEMANA", inbound: "", remarketing: "" }
);

/* Migração: funde as métricas LEADS INBOUND e LEADS REMARKETING num bloco só */
export function upgradeLeads(blocks) {
  const src = blocks || [];
  const solta = (b) => b.type === "metric" && /LEADS (INBOUND|REMARKETING)/i.test(b.title || "");
  if (src.some((b) => b.type === "leads")) {
    const rest = src.filter((b) => !solta(b));
    return rest.length === src.length ? blocks : rest;
  }
  const iIn = src.findIndex((b) => b.type === "metric" && /LEADS INBOUND/i.test(b.title || ""));
  const iRe = src.findIndex((b) => b.type === "metric" && /LEADS REMARKETING/i.test(b.title || ""));
  if (iIn < 0 && iRe < 0) return blocks;
  const dual = {
    id: uid(), type: "leads", title: "📥 LEADS DA SEMANA",
    inbound: iIn >= 0 ? (src[iIn].value || "") : "",
    remarketing: iRe >= 0 ? (src[iRe].value || "") : "",
    comment: (iIn >= 0 && src[iIn].comment) || (iRe >= 0 && src[iRe].comment) || "",
  };
  const pos = [iIn, iRe].filter((x) => x >= 0).sort((a, b) => a - b)[0];
  const out = [];
  src.forEach((b, i) => {
    if (i === pos) out.push(dual);
    if (i === iIn || i === iRe) return;
    out.push(b);
  });
  return out;
}

export const INBOUND_BLOCKS = () => ([
  CONSOLIDADO_BLOCK(),
  REUNIOES_BLOCK(),
  LEADS_BLOCK(),
  { id: uid(), type: "sql", title: "💰 SQL — COMITÊ", comite: "", aprovados: [], ressalvados: [], reprovados: [] },
  { id: uid(), type: "table", title: "💰 SQL — A APRESENTAR", cols: ["Incorporadora", "Volume (M)"], rows: [] },
  ...MIA_BLOCKS(),
  { id: uid(), type: "text", title: "📌 TEMA GERAL / OUTROS ASSUNTOS", text: "" },
  FUP_MURILO_BLOCK(),
]);

export const OUTBOUND_BLOCKS = () => ([
  { id: uid(), type: "metric", title: "🤝 REUNIÕES DA SEMANA", value: "" },
  { id: uid(), type: "sql", title: "💰 SQL — COMITÊ", comite: "", aprovados: [], ressalvados: [], reprovados: [] },
  { id: uid(), type: "table", title: "💰 SQL — A APRESENTAR", cols: ["Incorporadora", "Volume (M)"], rows: [] },
  { id: uid(), type: "text", title: "📌 TEMA GERAL / OUTROS ASSUNTOS", text: "" },
  FUP_MURILO_BLOCK(),
]);

export const PARCERIAS_BLOCKS = () => ([
  { id: uid(), type: "check", title: "🗓 FUP SEMANAL (SEGUNDAS) COM PARCEIROS", checked: false },
  { id: uid(), type: "check", title: "🤖 DISPAROS SEMANAIS PARCEIROS (AI)", checked: false },
  { id: uid(), type: "table", title: "☕ CAFÉ DA MANHÃ / TALK PARCEIROS DO MÊS", cols: ["Parceiro", "Data"], rows: [] },
  { id: uid(), type: "sql", title: "💰 SQL — COMITÊ ANTERIOR", comite: "", aprovados: [], ressalvados: [], reprovados: [] },
  { id: uid(), type: "table", title: "💰 SQL — A APRESENTAR", cols: ["Incorporadora", "Volume (M)"], rows: [] },
  { id: uid(), type: "table", title: "📞 CALLS REALIZADAS COM PARCEIROS NA SEMANA", cols: ["Parceiro", "Observação"], rows: [] },
  { id: uid(), type: "table", title: "📞 CALLS REALIZADAS COM CLIENTES NA SEMANA", cols: ["Cliente", "Observação"], rows: [] },
  { id: uid(), type: "list", title: "🤝 NOVOS PARCEIROS CONTRATADOS NA SEMANA", rows: [] },
  { id: uid(), type: "text", title: "📌 COMENTÁRIOS GERAIS", text: "" },
  FUP_MURILO_BLOCK(),
]);

/* Migração: acrescenta a coluna Cidade/UF nas Visitas a Agendar do Farming,
   preservando as linhas já digitadas. */
export function upgradeVisitas(blocks) {
  const src = blocks || [];
  const i = src.findIndex((b) => b.type === "table" && /VISITAS A AGENDAR/i.test(b.title || ""));
  if (i < 0) return blocks;
  const b = src[i];
  if ((b.cols || []).some((c) => /cidade/i.test(c))) return blocks;
  const pos = 2; // depois de "Previsão"
  const cols = [...(b.cols || [])];
  cols.splice(pos, 0, "Cidade/UF");
  const rows = (b.rows || []).map((r) => { const nr = [...r]; nr.splice(pos, 0, ""); return nr; });
  const out = [...src];
  out[i] = { ...b, cols, rows };
  return out;
}

/* Fatos objetivos comparando os blocos desta semana com os da anterior —
   alimenta o comparativo da ata gerada pela IA. */
export function compareBlocks(prev, cur) {
  const facts = [];
  const norm = (s) => (s || "").trim().toLowerCase();
  const num = (s) => { const m = String(s || "").replace(",", ".").match(/[\d.]+/); return m ? parseFloat(m[0]) : 0; };
  const fmtN = (n) => String(Math.round(n * 10) / 10).replace(".", ",");
  (cur || []).forEach((cb) => {
    const pb = (prev || []).find((x) => x.id === cb.id || x.title === cb.title);
    if (!pb) return;
    if (cb.type === "list" || cb.type === "table") {
      const names = (b) => (b.rows || []).map((r) => (Array.isArray(r) ? r[0] : r)).filter(Boolean);
      const pRaw = names(pb), cRaw = names(cb);
      const pN = pRaw.map(norm), cN = cRaw.map(norm);
      const added = cRaw.filter((n) => !pN.includes(norm(n)));
      const removed = pRaw.filter((n) => !cN.includes(norm(n)));
      facts.push(`${cb.title}: ${cRaw.length} itens (antes ${pRaw.length}); entraram: ${added.join(", ") || "nenhum"}; saíram: ${removed.join(", ") || "nenhum"}`);
      if (/agendar|a realizar/i.test(cb.title)) {
        const stag = cRaw.filter((n) => pN.includes(norm(n)));
        if (stag.length) facts.push(`${cb.title} — repetem da semana anterior sem evolução: ${stag.join(", ")}`);
      }
      if (Array.isArray((cb.rows || [])[0]) && cb.cols) {
        cb.cols.forEach((c, ci) => {
          if (/opera|volume|valor|\(m\)|n[ºo]/i.test(c)) {
            const sum = (b) => (b.rows || []).reduce((a, r) => a + num(r[ci]), 0);
            const sc = sum(cb), sp = sum(pb);
            if (sc || sp) facts.push(`${cb.title} — total de "${c}": ${fmtN(sc)} (antes ${fmtN(sp)}, Δ ${sc - sp >= 0 ? "+" : ""}${fmtN(sc - sp)})`);
          }
        });
      }
    }
    if (cb.type === "check") {
      if (!!cb.checked !== !!pb.checked) facts.push(`${cb.title}: ${cb.checked ? "passou a Realizado" : "voltou a Não realizado"}`);
    }
    if (cb.type === "metric") {
      const c = num(cb.value), p = num(pb.value);
      if (c || p) facts.push(`${cb.title}: ${fmtN(c)} (antes ${fmtN(p)}, Δ ${c - p >= 0 ? "+" : ""}${fmtN(c - p)})`);
    }
    if (cb.type === "reunioes") {
      [["agendadas", "Reuniões agendadas"], ["realizadas", "Reuniões realizadas"]].forEach(([k, label]) => {
        const c = num(cb[k]), p = num(pb[k]);
        if (c || p) facts.push(`${label}: ${fmtN(c)} (antes ${fmtN(p)}, Δ ${c - p >= 0 ? "+" : ""}${fmtN(c - p)})`);
      });
    }
    if (cb.type === "leads") {
      [["inbound", "Leads inbound"], ["remarketing", "Leads remarketing"]].forEach(([k, label]) => {
        const c = num(cb[k]), p = num(pb[k]);
        if (c || p) facts.push(`${label}: ${fmtN(c)} (antes ${fmtN(p)}, Δ ${c - p >= 0 ? "+" : ""}${fmtN(c - p)})`);
      });
    }
    if (cb.type === "sql") {
      ["aprovados", "ressalvados", "reprovados"].forEach((g) => {
        const sum = (b) => (b[g] || []).reduce((a, r) => a + num(r[1]), 0);
        facts.push(`SQL ${g.toUpperCase()}: ${fmtN(sum(cb))}M no comitê ${cb.comite || "?"} vs ${fmtN(sum(pb))}M no comitê ${pb.comite || "?"}`);
      });
    }
  });
  return facts;
}
