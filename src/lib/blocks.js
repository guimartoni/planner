import { uid } from "./util.js";

/* Bloco do FUP de segunda com o Murilo — data + tema geral/outros assuntos */
export const FUP_MURILO_BLOCK = () => (
  { id: uid(), type: "fup", title: "🤝 FUP MURILO", date: "", text: "" }
);

export const FARMING_BLOCKS = () => ([
  { id: uid(), type: "list", title: "📍 VISITAS REALIZADAS NA SEMANA", rows: [] },
  { id: uid(), type: "table", title: "📅 VISITAS AGENDADAS", cols: ["Incorporadora", "Data", "Cidade/UF"], rows: [] },
  { id: uid(), type: "table", title: "🔜 VISITAS A AGENDAR", cols: ["Incorporadora", "Previsão", "Observação"], rows: [] },
  { id: uid(), type: "table", title: "📞 CALLS DE PIPE REALIZADAS", cols: ["Incorporadora", "Nº operações", "Pendência"], rows: [] },
  { id: uid(), type: "table", title: "📞 CALLS DE PIPE A REALIZAR", cols: ["Incorporadora", "Observação"], rows: [] },
  { id: uid(), type: "sql", title: "💰 SQL — COMITÊ", comite: "", aprovados: [], ressalvados: [], reprovados: [] },
  { id: uid(), type: "table", title: "💰 SQL — A APRESENTAR", cols: ["Incorporadora", "Volume (M)"], rows: [] },
  { id: uid(), type: "text", title: "📌 TEMA GERAL / OUTROS ASSUNTOS", text: "" },
  FUP_MURILO_BLOCK(),
]);

export const INBOUND_BLOCKS = () => ([
  { id: uid(), type: "metric", title: "🤝 REUNIÕES DA SEMANA", value: "" },
  { id: uid(), type: "metric", title: "📥 LEADS INBOUND", value: "" },
  { id: uid(), type: "metric", title: "🔁 LEADS REMARKETING", value: "" },
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
    if (cb.type === "sql") {
      ["aprovados", "ressalvados", "reprovados"].forEach((g) => {
        const sum = (b) => (b[g] || []).reduce((a, r) => a + num(r[1]), 0);
        facts.push(`SQL ${g.toUpperCase()}: ${fmtN(sum(cb))}M no comitê ${cb.comite || "?"} vs ${fmtN(sum(pb))}M no comitê ${pb.comite || "?"}`);
      });
    }
  });
  return facts;
}
