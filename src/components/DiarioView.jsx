import { useRef, useState } from "react";
import { ArrowRight, CalendarClock, Check, Plus, RotateCcw, Star, Tag, X } from "lucide-react";
import { C, dateKeyBR, plusDaysBR, todayBR, uid } from "../lib/util.js";
import { useAutoGrow } from "../lib/autoGrow.js";
import { DateBR } from "./Blocks.jsx";

/* Diário em tela única (27/10/2026): no lugar de uma página por dia, uma lista
   só de tarefas. Cada tarefa guarda o dia em que foi lançada, uma data de FUP
   opcional e a marca de prioridade. Concluir tira a tarefa daqui e leva para a
   página "Concluídas" (mode="concluidas"), de onde ela pode ser reaberta.

   Cada tarefa pode ter um assunto: as áreas do app (abas) já vêm como opção e
   o usuário cria outros na hora (guardados em meta.diario.categorias).

   Dados em meta.diario = { categorias: [nome], tarefas: [{ id, texto, criadaEm,
   fup, categoria, prioridade, concluida, concluidaEm }] }. */

export const normalizaDiario = (d) => ({
  categorias: (d && d.categorias) || [],
  tarefas: ((d && d.tarefas) || []).map((t) => ({
    id: t.id || uid(),
    texto: t.texto || "",
    criadaEm: t.criadaEm || todayBR(),
    fup: t.fup || "",
    categoria: t.categoria || "",
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

/* Caixa de texto que aceita várias linhas e cresce junto com o texto.
   Enter lança/confirma (onEnter); Shift+Enter quebra a linha. */
function CaixaTexto({ value, onChange, onEnter, placeholder, style }) {
  const ref = useRef(null);
  useAutoGrow(ref, value, { modo: "minimo" });
  return (
    <textarea ref={ref} rows={1} value={value || ""} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && onEnter) { e.preventDefault(); onEnter(); } }}
      className={celaCls + " leading-5 resize-none overflow-hidden whitespace-pre-wrap"} style={style} />
  );
}

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

/* cor fixa por assunto (mesmo nome, mesma cor) */
const CORES_ASSUNTO = [
  ["#E7E7FB", "#4338CA"], ["#E4F1EB", "#1E6B4F"], ["#FBEEDB", "#B45309"], ["#FBE7EF", "#9D2960"],
  ["#E1F0F5", "#0E6E8C"], ["#ECE8F6", "#5B4A9E"], ["#F5EEDC", "#8A5A00"], ["#E3ECF7", "#2E6BB0"],
];
const corAssunto = (nome) => {
  let h = 0;
  for (const ch of nome || "") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [background, color] = CORES_ASSUNTO[h % CORES_ASSUNTO.length];
  return { background, color };
};

/* Assunto: etiqueta que abre um menu com as áreas do app + assuntos criados,
   e um campo para criar um novo na hora. */
function CampoAssunto({ valor, opcoes, onChange, onCriar, largura = 150 }) {
  const [aberto, setAberto] = useState(false);
  const [novo, setNovo] = useState("");
  const criar = () => {
    const n = novo.trim();
    if (!n) return;
    onCriar(n); // registra o assunto e já aplica (uma gravação só)
    setNovo("");
    setAberto(false);
  };
  return (
    <span className="relative shrink-0 self-center" style={{ width: largura }}>
      <button onClick={() => setAberto(!aberto)} title={valor ? `Assunto: ${valor} — clique para mudar` : "Definir o assunto"}
        className="w-full flex items-center justify-center gap-1 px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap overflow-hidden"
        style={valor ? corAssunto(valor) : { color: "#9CA3AF", border: "1px dashed #D9DDE3" }}>
        <Tag size={11} className="shrink-0" />
        <span className="truncate">{valor || "Assunto"}</span>
      </button>
      {aberto && (
        <>
          <span className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 rounded-xl border shadow-lg overflow-hidden"
            style={{ background: "#fff", borderColor: C.line, width: 220 }}>
            <div className="max-h-64 overflow-y-auto py-1">
              {valor && (
                <button onClick={() => { onChange(""); setAberto(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50" style={{ color: "#9CA3AF" }}>
                  — sem assunto
                </button>
              )}
              {opcoes.map((o) => (
                <button key={o} onClick={() => { onChange(o); setAberto(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-gray-50"
                  style={{ color: "#374151", fontWeight: o === valor ? 700 : 400 }}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: corAssunto(o).color }} />
                  <span className="flex-1 truncate">{o}</span>
                  {o === valor && <Check size={12} />}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 p-1.5 border-t" style={{ borderColor: C.line }}>
              <input value={novo} onChange={(e) => setNovo(e.target.value)} autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") criar(); if (e.key === "Escape") setAberto(false); }}
                placeholder="Novo assunto…" className="flex-1 min-w-0 border rounded-md px-2 py-1 text-xs outline-none"
                style={{ borderColor: C.line }} />
              <button onClick={criar} className="p-1 rounded-md text-white" style={{ background: C.stamp }} title="Criar assunto">
                <Plus size={12} />
              </button>
            </div>
          </div>
        </>
      )}
    </span>
  );
}

export default function DiarioView({ diario, onChange, mode = "abertas", onIrPara, areas = [] }) {
  const dados = normalizaDiario(diario);
  const [novo, setNovo] = useState({ texto: "", fup: "", categoria: "", prioridade: false });
  const [filtro, setFiltro] = useState("todas"); // todas | prioridade | fup
  const [filtroAssunto, setFiltroAssunto] = useState("");
  const [busca, setBusca] = useState("");

  /* assuntos: áreas do app + os criados aqui + os que já estão em uso */
  const assuntos = [...new Set([...areas, ...dados.categorias, ...dados.tarefas.map((t) => t.categoria).filter(Boolean)])];
  /* cria o assunto (se ainda não existe) e aplica na tarefa `id` — sem id, é
     a tarefa que está sendo lançada */
  const criarAssunto = (id) => (n) => {
    const existente = assuntos.find((a) => a.toLowerCase() === n.toLowerCase());
    const nome = existente || n;
    if (!id) setNovo((x) => ({ ...x, categoria: nome }));
    onChange({
      ...dados,
      categorias: existente ? dados.categorias : [...dados.categorias, n],
      tarefas: id ? dados.tarefas.map((t) => (t.id === id ? { ...t, categoria: nome } : t)) : dados.tarefas,
    });
  };

  const setTarefas = (tarefas) => onChange({ ...dados, tarefas });
  const patch = (id, campos) => setTarefas(dados.tarefas.map((t) => (t.id === id ? { ...t, ...campos } : t)));
  const excluir = (id) => setTarefas(dados.tarefas.filter((t) => t.id !== id));

  const adicionar = () => {
    const texto = novo.texto.trim();
    if (!texto) return;
    setTarefas([{ id: uid(), texto, criadaEm: todayBR(), fup: novo.fup, categoria: novo.categoria, prioridade: novo.prioridade, concluida: false, concluidaEm: null }, ...dados.tarefas]);
    setNovo({ texto: "", fup: "", categoria: novo.categoria, prioridade: false });
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
  const casaBusca = (t) => (!termo || t.texto.toLowerCase().includes(termo) || t.categoria.toLowerCase().includes(termo))
    && (!filtroAssunto || t.categoria === filtroAssunto);

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
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5">
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
                  {t.categoria && (
                    <span className="shrink-0 px-2 py-0.5 rounded-md text-xs font-medium" style={corAssunto(t.categoria)}>{t.categoria}</span>
                  )}
                  <span className="flex-1 text-sm line-through whitespace-pre-wrap" style={{ color: "#6B7280", textDecorationColor: "#C3C8CF" }}>{t.texto}</span>
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
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5">
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
        Lance as tarefas aqui — cada uma fica com o dia em que foi criada. ⭐ marca prioridade, FUP agenda o retorno, o assunto organiza e a seta → conclui (vai para Concluídas).
      </p>

      {/* lançamento rápido */}
      <div className="rounded-xl border shadow-sm p-2.5 mb-3 flex items-stretch gap-1.5" style={{ borderColor: C.line, background: C.paper }}>
        <EstrelaPrioridade ligada={novo.prioridade} onClick={() => setNovo({ ...novo, prioridade: !novo.prioridade })} />
        <CaixaTexto value={novo.texto} onChange={(v) => setNovo({ ...novo, texto: v })} onEnter={adicionar}
          placeholder="Nova tarefa… (Enter lança · Shift+Enter pula linha)"
          style={{ ...celaStyle, flex: 1, minWidth: 0 }} />
        <CampoFup valor={novo.fup} onChange={(v) => setNovo({ ...novo, fup: v })} />
        <CampoAssunto valor={novo.categoria} opcoes={assuntos} onCriar={criarAssunto(null)}
          onChange={(v) => setNovo({ ...novo, categoria: v })} />
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
        <select value={filtroAssunto} onChange={(e) => setFiltroAssunto(e.target.value)}
          className="ml-auto border rounded-full px-2.5 py-1 text-xs outline-none"
          style={{ ...celaStyle, ...(filtroAssunto ? corAssunto(filtroAssunto) : {}) }}>
          <option value="">Todos os assuntos</option>
          {assuntos.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…"
          className=" border rounded-full px-3 py-1 text-xs outline-none" style={{ ...celaStyle, width: 160 }} />
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
                  <CaixaTexto value={t.texto} onChange={(v) => patch(t.id, { texto: v })}
                    onEnter={(e) => document.activeElement && document.activeElement.blur()}
                    style={{ ...celaStyle, flex: 1, minWidth: 0, ...(t.prioridade ? { borderColor: "#F5D28A", background: "#FFFBEB" } : {}) }} />
                  <CampoFup valor={t.fup} onChange={(v) => patch(t.id, { fup: v })} />
                  <CampoAssunto valor={t.categoria} opcoes={assuntos} onCriar={criarAssunto(t.id)}
                    onChange={(v) => patch(t.id, { categoria: v })} />
                  <button onClick={() => patch(t.id, { concluida: true, concluidaEm: todayBR() })}
                    className="shrink-0 self-center w-8 h-8 flex items-center justify-center rounded-full border transition-colors hover:bg-[#1E6B4F] hover:text-white"
                    style={{ borderColor: C.stamp, color: C.stamp }} title="Concluir — vai para a página Concluídas">
                    <ArrowRight size={15} />
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
