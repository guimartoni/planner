import { useState } from "react";
import { CalendarClock, Check, Plus, RotateCcw, Star, X } from "lucide-react";
import { C, dateKeyBR, plusDaysBR, todayBR, uid } from "../lib/util.js";
import { DateBR, GrowCell } from "./Blocks.jsx";

/* Diário em tela única (27/10/2026): no lugar de uma página por dia, uma lista
   só de tarefas. Cada tarefa guarda o dia em que foi lançada, uma data de FUP
   opcional e a marca de prioridade. Concluir tira a tarefa daqui e leva para a
   página "Concluídas" (mode="concluidas"), de onde ela pode ser reaberta.

   Dados em meta.diario = { tarefas: [{ id, texto, criadaEm, fup, prioridade,
   concluida, concluidaEm }] }. */

export const normalizaDiario = (d) => ({
  tarefas: ((d && d.tarefas) || []).map((t) => ({
    id: t.id || uid(),
    texto: t.texto || "",
    criadaEm: t.criadaEm || todayBR(),
    fup: t.fup || "",
    prioridade: !!t.prioridade,
    concluida: !!t.concluida,
    concluidaEm: t.concluidaEm || null,
  })),
});

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const diaDaSemana = (br) => {
  const m = (br || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? DIAS[new Date(+m[3], +m[2] - 1, +m[1]).getDay()] : "";
};
const rotuloDia = (br) => {
  if (br === todayBR()) return "Hoje";
  if (br === plusDaysBR(todayBR(), -1)) return "Ontem";
  const d = diaDaSemana(br);
  return d ? d[0].toUpperCase() + d.slice(1) : br;
};

/* situação do FUP em relação a hoje */
const fupEstado = (fup) => {
  if (!fup) return null;
  const k = dateKeyBR(fup), h = dateKeyBR(todayBR());
  return k < h ? "vencido" : k === h ? "hoje" : "futuro";
};
const FUP_COR = {
  vencido: { background: "#FCEBEB", color: "#A32D2D" },
  hoje: { background: C.dateSoft, color: C.date },
  futuro: { background: "#EEF0F2", color: "#4B5563" },
};

const celaCls = "border rounded-lg px-2.5 py-1.5 text-sm outline-none w-full";
const celaStyle = { borderColor: "#E3E5DE", background: "#fff", color: "#1F2937" };

function EstrelaPrioridade({ ligada, onClick }) {
  return (
    <button onClick={onClick} title={ligada ? "Prioridade — clique para tirar" : "Marcar como prioridade"}
      className="shrink-0 self-center p-1 rounded-md transition-colors"
      style={{ color: ligada ? "#D97706" : "#C3C8CF" }}>
      <Star size={16} fill={ligada ? "#F59E0B" : "none"} />
    </button>
  );
}

/* FUP: etiqueta com a data que vira calendário ao clicar */
function CampoFup({ valor, onChange, largura = 118 }) {
  const [editando, setEditando] = useState(false);
  if (editando) {
    return (
      <DateBR value={valor} autoFocus onBlur={() => setEditando(false)}
        onChange={(v) => { onChange(v); setEditando(false); }}
        className="border rounded-lg px-1.5 py-1 text-xs outline-none shrink-0 self-center"
        style={{ ...celaStyle, width: largura }} />
    );
  }
  const est = fupEstado(valor);
  return (
    <span className="shrink-0 self-center flex items-center gap-0.5" style={{ width: largura }}>
      <button onClick={() => setEditando(true)} title={valor ? "Data do FUP — clique para mudar" : "Definir data de FUP"}
        className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap"
        style={valor ? FUP_COR[est] : { color: "#9CA3AF", border: "1px dashed #D9DDE3" }}>
        <CalendarClock size={12} />
        {valor ? `FUP ${valor.slice(0, 5)}` : "FUP"}
      </button>
      {valor && (
        <button onClick={() => onChange("")} title="Tirar o FUP" className="p-0.5" style={{ color: "#C3C8CF" }}>
          <X size={11} />
        </button>
      )}
    </span>
  );
}

export default function DiarioView({ diario, onChange, mode = "abertas", onIrPara }) {
  const dados = normalizaDiario(diario);
  const [novo, setNovo] = useState({ texto: "", fup: "", prioridade: false });
  const [filtro, setFiltro] = useState("todas"); // todas | prioridade | fup
  const [busca, setBusca] = useState("");

  const setTarefas = (tarefas) => onChange({ ...dados, tarefas });
  const patch = (id, campos) => setTarefas(dados.tarefas.map((t) => (t.id === id ? { ...t, ...campos } : t)));
  const excluir = (id) => setTarefas(dados.tarefas.filter((t) => t.id !== id));

  const adicionar = () => {
    const texto = novo.texto.trim();
    if (!texto) return;
    setTarefas([{ id: uid(), texto, criadaEm: todayBR(), fup: novo.fup, prioridade: novo.prioridade, concluida: false, concluidaEm: null }, ...dados.tarefas]);
    setNovo({ texto: "", fup: "", prioridade: false });
  };

  const abertas = dados.tarefas.filter((t) => !t.concluida);
  const concluidas = dados.tarefas.filter((t) => t.concluida);
  const nPrioridade = abertas.filter((t) => t.prioridade).length;
  const nFupVencido = abertas.filter((t) => fupEstado(t.fup) === "vencido").length;
  const nFupHoje = abertas.filter((t) => fupEstado(t.fup) === "hoje").length;

  /* agrupa por dia (criação nas abertas, conclusão nas concluídas), mais recente primeiro */
  const agrupar = (lista, campo) => {
    const g = {};
    lista.forEach((t) => { const k = t[campo] || "—"; (g[k] = g[k] || []).push(t); });
    return Object.keys(g)
      .sort((a, b) => (dateKeyBR(b) || "").localeCompare(dateKeyBR(a) || ""))
      .map((dia) => ({ dia, itens: g[dia] }));
  };
  const ordenar = (itens) => [...itens].sort((a, b) => (b.prioridade - a.prioridade));

  const termo = busca.trim().toLowerCase();
  const casaBusca = (t) => !termo || t.texto.toLowerCase().includes(termo);

  const cabecalhoDia = (dia, n) => (
    <div className="flex items-baseline gap-2 px-1 pt-3 pb-1.5 border-b mb-1" style={{ borderColor: "#EDEDE6" }}>
      <span className="text-sm font-bold" style={{ color: dia === todayBR() ? C.stamp : "#1F2937", fontFamily: "Georgia, serif" }}>
        {rotuloDia(dia)}
      </span>
      <span className="text-xs" style={{ color: "#9CA3AF" }}>{dia}</span>
      <span className="text-xs ml-auto" style={{ color: "#9CA3AF" }}>{n} tarefa{n > 1 ? "s" : ""}</span>
    </div>
  );

  if (mode === "concluidas") {
    const lista = concluidas.filter(casaBusca);
    return (
      <div className="max-w-4xl mx-auto px-4 py-5">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="flex-1 text-xl font-semibold" style={{ color: "#1F2937", fontFamily: "Georgia, serif" }}>✅ Concluídas</h1>
          {onIrPara && (
            <button onClick={() => onIrPara("diario")} className="px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ background: C.stampSoft, color: C.stamp }}>
              ← Tarefas em aberto ({abertas.length})
            </button>
          )}
        </div>
        <p className="text-xs mb-3" style={{ color: "#9CA3AF" }}>
          Agrupadas pelo dia em que foram concluídas. <b>Reabrir</b> devolve a tarefa para a lista em aberto.
        </p>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nas concluídas…"
          className={celaCls + " mb-2"} style={celaStyle} />
        {lista.length === 0 && (
          <p className="text-sm px-1 py-6 text-center" style={{ color: "#9CA3AF" }}>
            {concluidas.length ? "Nada encontrado." : "Nenhuma tarefa concluída ainda."}
          </p>
        )}
        <div className="rounded-xl border shadow-sm px-3 pb-3" style={{ borderColor: C.line, background: C.paper, display: lista.length ? "block" : "none" }}>
          {agrupar(lista, "concluidaEm").map((g) => (
            <div key={g.dia}>
              {cabecalhoDia(g.dia, g.itens.length)}
              {g.itens.map((t) => (
                <div key={t.id} className="flex items-center gap-2 py-1.5 px-1 group">
                  <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: C.stamp }}>
                    <Check size={12} color="#fff" />
                  </span>
                  {t.prioridade && <Star size={13} fill="#F59E0B" color="#D97706" className="shrink-0" />}
                  <span className="flex-1 text-sm line-through" style={{ color: "#6B7280", textDecorationColor: "#C3C8CF" }}>{t.texto}</span>
                  <span className="text-xs shrink-0 hidden sm:inline" style={{ color: "#9CA3AF" }}>
                    criada {t.criadaEm.slice(0, 5)}{t.fup ? ` · FUP ${t.fup.slice(0, 5)}` : ""}
                  </span>
                  <button onClick={() => patch(t.id, { concluida: false, concluidaEm: null })}
                    className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
                    style={{ background: "#EEF0F2", color: "#4B5563" }} title="Voltar para as tarefas em aberto">
                    <RotateCcw size={12} /> Reabrir
                  </button>
                  <button onClick={() => excluir(t.id)} className="shrink-0 p-1 opacity-40 group-hover:opacity-100"
                    style={{ color: C.danger }} title="Excluir">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const visiveis = abertas.filter(casaBusca).filter((t) =>
    filtro === "prioridade" ? t.prioridade
      : filtro === "fup" ? !!t.fup && fupEstado(t.fup) !== "futuro"
        : true);
  const chip = (k, rotulo, estilo) => (
    <button onClick={() => setFiltro(filtro === k ? "todas" : k)}
      className="px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ ...estilo, outline: filtro === k ? `2px solid ${estilo.color}` : "none", outlineOffset: 1 }}>
      {rotulo}
    </button>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-5">
      <div className="flex items-center gap-2 mb-1">
        <h1 className="flex-1 text-xl font-semibold" style={{ color: "#1F2937", fontFamily: "Georgia, serif" }}>📋 Tarefas</h1>
        {onIrPara && (
          <button onClick={() => onIrPara("diario-concluidas")} className="px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{ background: "#E2E5E9", color: "#374151" }}>
            ✅ Concluídas ({concluidas.length})
          </button>
        )}
      </div>
      <p className="text-xs mb-3" style={{ color: "#9CA3AF" }}>
        Lance as tarefas aqui — cada uma fica com o dia em que foi criada. ⭐ marca prioridade, FUP agenda o retorno e ✓ conclui (vai para Concluídas).
      </p>

      {/* lançamento rápido */}
      <div className="rounded-xl border shadow-sm p-2.5 mb-3 flex items-stretch gap-1.5" style={{ borderColor: C.line, background: C.paper }}>
        <EstrelaPrioridade ligada={novo.prioridade} onClick={() => setNovo({ ...novo, prioridade: !novo.prioridade })} />
        <GrowCell value={novo.texto} onChange={(v) => setNovo({ ...novo, texto: v })}
          onKeyDown={(e) => { if (e.key === "Enter") adicionar(); }}
          placeholder="Nova tarefa… (Enter para lançar)"
          className={celaCls} style={{ ...celaStyle, flex: 1, minWidth: 0 }} />
        <CampoFup valor={novo.fup} onChange={(v) => setNovo({ ...novo, fup: v })} />
        <button onClick={adicionar}
          className="shrink-0 self-center flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-white"
          style={{ background: C.stamp, opacity: novo.texto.trim() ? 1 : 0.5 }}>
          <Plus size={14} /> <span className="hidden sm:inline">Lançar</span>
        </button>
      </div>

      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {chip("todas", `${abertas.length} em aberto`, { background: "#EEF0F2", color: "#4B5563" })}
        {chip("prioridade", `⭐ ${nPrioridade} prioridade${nPrioridade === 1 ? "" : "s"}`, { background: "#FEF3C7", color: "#B45309" })}
        {chip("fup", `FUP: ${nFupHoje} hoje${nFupVencido ? ` · ${nFupVencido} vencido${nFupVencido > 1 ? "s" : ""}` : ""}`,
          nFupVencido ? FUP_COR.vencido : FUP_COR.hoje)}
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…"
          className="ml-auto border rounded-full px-3 py-1 text-xs outline-none" style={{ ...celaStyle, width: 160 }} />
      </div>

      {visiveis.length === 0 ? (
        <p className="text-sm px-1 py-8 text-center" style={{ color: "#9CA3AF" }}>
          {abertas.length ? "Nada neste filtro." : "Nenhuma tarefa em aberto. Lance a primeira aí em cima."}
        </p>
      ) : (
        <div className="rounded-xl border shadow-sm px-3 pb-3" style={{ borderColor: C.line, background: C.paper }}>
          {agrupar(visiveis, "criadaEm").map((g) => (
            <div key={g.dia}>
              {cabecalhoDia(g.dia, g.itens.length)}
              {ordenar(g.itens).map((t) => (
                <div key={t.id} className="flex items-stretch gap-1.5 py-1 group">
                  <EstrelaPrioridade ligada={t.prioridade} onClick={() => patch(t.id, { prioridade: !t.prioridade })} />
                  <GrowCell value={t.texto} onChange={(v) => patch(t.id, { texto: v })}
                    className={celaCls}
                    style={{ ...celaStyle, flex: 1, minWidth: 0, ...(t.prioridade ? { borderColor: "#F5D28A", background: "#FFFBEB" } : {}) }} />
                  <CampoFup valor={t.fup} onChange={(v) => patch(t.id, { fup: v })} />
                  <button onClick={() => patch(t.id, { concluida: true, concluidaEm: todayBR() })}
                    className="shrink-0 self-center flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors hover:bg-[#1E6B4F] hover:text-white"
                    style={{ borderColor: C.stamp, color: C.stamp }} title="Concluir — vai para a página Concluídas">
                    <Check size={13} /> <span className="hidden sm:inline">Concluído</span>
                  </button>
                  <button onClick={() => excluir(t.id)} className="shrink-0 self-center p-1 opacity-30 group-hover:opacity-100"
                    style={{ color: C.danger }} title="Excluir (Ctrl+Z desfaz)">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
