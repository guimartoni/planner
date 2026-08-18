import { useRef, useState } from "react";
import { History, Plus, X } from "lucide-react";
import { C, dateKeyBR, todayBR, uid } from "../lib/util.js";
import { useAutoGrow } from "../lib/autoGrow.js";
import { chaveSemana, ehSemanaAtual, faixaSemana, rotuloSemana, segundaDa, semanaAtual, statusDe } from "../lib/semana.js";
import { DateBR, GrowCell } from "./Blocks.jsx";

/* Aba da MIA: atividades programadas por SEMANA, divididas em seções que o
   usuário nomeia (padrão: Farejador e Inbound + RMKT), com comentários gerais
   e um cronograma que junta tudo semana a semana.

   Trocar a semana de uma atividade conta como reprogramação: o app guarda o
   de-para e a linha ganha a etiqueta "reprogramado" (o histórico abre num
   pop-up). O status sai sozinho da semana: concluída, atraso (a semana já
   terminou) ou a executar. */

export const SECOES_PADRAO = () => ([
  { id: uid(), nome: "Farejador", atividades: [] },
  { id: uid(), nome: "Inbound + RMKT", atividades: [] },
]);

/* meta.mia começou como uma lista simples de atividades; aqui ela vira o
   formato com seções, sem perder nada (o que fala de Farejador vai para a
   seção do Farejador; o resto para Inbound + RMKT). */
export function normalizaMia(mia) {
  if (mia && !Array.isArray(mia) && Array.isArray(mia.secoes)) return mia;
  const antigas = Array.isArray(mia) ? mia : [];
  const secoes = SECOES_PADRAO();
  antigas.forEach((a) => {
    const item = {
      id: a.id || uid(),
      atividade: a.atividade || "",
      semana: segundaDa(a.semana || a.data || ""),
      criadaEm: a.criadaEm || "",
      concluida: !!a.concluida,
      concluidaEm: a.concluidaEm || null,
      historico: a.historico || [],
    };
    const alvo = /farejador/i.test(item.atividade) ? secoes[0] : secoes[1];
    alvo.atividades.push(item);
  });
  return { secoes, comentarios: (mia && mia.comentarios) || "" };
}

const ESTILO = {
  concluido: { rotulo: "✅ Concluído", background: C.stampSoft, color: C.stamp },
  atraso: { rotulo: "⚠️ Atraso", background: "#FCEBEB", color: "#A32D2D" },
  "a-executar": { rotulo: "🕒 A executar", background: "#EEF0F2", color: "#4B5563" },
};

const celaCls = "border rounded-lg px-2 py-1.5 text-sm outline-none w-full";
const celaStyle = { borderColor: "#E3E5DE", background: "#fff", color: "#374151" };
const L = { criada: 92, semana: 140, reprog: 122, status: 118, lixo: 22 };

/* Data de criação: texto discreto que vira campo de data ao clicar. */
function DataCriacao({ valor, onChange }) {
  const [editando, setEditando] = useState(false);
  if (editando) {
    return (
      <DateBR value={valor} autoFocus onBlur={() => setEditando(false)}
        onChange={(v) => { onChange(v); setEditando(false); }}
        className="border rounded-lg px-1 py-1 text-xs outline-none"
        style={{ ...celaStyle, width: L.criada }} />
    );
  }
  return (
    <button onClick={() => setEditando(true)} title="Data de cadastro — clique para corrigir"
      className="shrink-0 self-center text-xs text-left px-1"
      style={{ width: L.criada, color: valor ? "#9CA3AF" : "#C3C8CF" }}>
      {valor ? valor.slice(0, 5) : "— definir"}
    </button>
  );
}

/* Semana de execução: mostra "semana 17/08" e abre o calendário ao clicar —
   qualquer dia escolhido vira a segunda-feira daquela semana. */
function SemanaCampo({ valor, onChange, placeholder = "definir semana" }) {
  const [editando, setEditando] = useState(false);
  if (editando) {
    return (
      <DateBR value={valor} autoFocus onBlur={() => setEditando(false)}
        onChange={(v) => { onChange(v); setEditando(false); }}
        className={celaCls} style={{ ...celaStyle, width: L.semana, flexShrink: 0 }} />
    );
  }
  const atual = ehSemanaAtual(valor);
  return (
    <button onClick={() => setEditando(true)} title="Clique para escolher a semana"
      className="shrink-0 self-center px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap"
      style={{
        width: L.semana,
        background: valor ? (atual ? C.stampSoft : "#F1F2F4") : "transparent",
        color: valor ? (atual ? C.stamp : "#4B5563") : "#C3C8CF",
        border: valor ? "none" : "1px dashed #D9DDE3",
      }}>
      {valor ? rotuloSemana(valor) : placeholder}
    </button>
  );
}

function Comentarios({ valor, onChange }) {
  const ref = useRef(null);
  useAutoGrow(ref, valor, { sempre: true });
  return (
    <textarea
      ref={ref}
      value={valor || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Observações, combinados e contexto que valem para a MIA como um todo…"
      className="w-full border rounded-lg px-3 py-2 text-sm leading-6 outline-none resize-none overflow-hidden"
      style={{ ...celaStyle, minHeight: 90 }}
    />
  );
}

export default function MiaView({ mia, onChange }) {
  const dados = normalizaMia(mia);
  const [draft, setDraft] = useState({});          // rascunho por seção
  const [verHistorico, setVerHistorico] = useState(null);
  const [verConcluidas, setVerConcluidas] = useState({});

  const setSecoes = (secoes) => onChange({ ...dados, secoes });
  const patchSecao = (sid, campos) => setSecoes(dados.secoes.map((s) => (s.id === sid ? { ...s, ...campos } : s)));
  const patchAtiv = (sid, aid, campos) => patchSecao(sid, {
    atividades: (dados.secoes.find((s) => s.id === sid).atividades).map((a) => (a.id === aid ? { ...a, ...campos } : a)),
  });

  /* Trocar a semana é uma reprogramação: guarda de-para e quando mudou. */
  const mudarSemana = (sid, a, novaData) => {
    const nova = segundaDa(novaData);
    if ((a.semana || "") === (nova || "")) return;
    const historico = a.semana && nova
      ? [...(a.historico || []), { de: a.semana, para: nova, em: todayBR() }]
      : (a.historico || []);
    patchAtiv(sid, a.id, { semana: nova, historico });
  };

  const adicionar = (sid) => {
    const d = draft[sid] || {};
    if (!(d.atividade || "").trim()) return;
    const s = dados.secoes.find((x) => x.id === sid);
    patchSecao(sid, {
      atividades: [...s.atividades, {
        id: uid(), atividade: d.atividade.trim(), semana: segundaDa(d.semana || ""),
        criadaEm: todayBR(), concluida: false, historico: [],
      }],
    });
    setDraft({ ...draft, [sid]: {} });
  };

  const todas = dados.secoes.flatMap((s) => s.atividades.map((a) => ({ ...a, secao: s.nome })));
  const emAtraso = todas.filter((a) => statusDe(a) === "atraso").length;
  const abertas = todas.filter((a) => !a.concluida).length;
  const naSemana = todas.filter((a) => !a.concluida && a.semana === semanaAtual()).length;

  const ordem = { atraso: 0, "a-executar": 1, concluido: 2 };
  const ordenar = (lista) => [...lista].sort((x, y) => {
    const s = ordem[statusDe(x)] - ordem[statusDe(y)];
    return s || chaveSemana(x.semana).localeCompare(chaveSemana(y.semana));
  });

  const linha = (sid) => (a) => {
    const e = ESTILO[statusDe(a)];
    const reprog = (a.historico || []).length;
    return (
      <div key={a.id} className="flex items-stretch gap-1.5 py-1">
        <DataCriacao valor={a.criadaEm} onChange={(v) => patchAtiv(sid, a.id, { criadaEm: v })} />
        <GrowCell value={a.atividade} onChange={(v) => patchAtiv(sid, a.id, { atividade: v })}
          className={celaCls} style={{ ...celaStyle, flex: "1 1 240px", minWidth: 160, opacity: a.concluida ? 0.6 : 1 }} />
        <SemanaCampo valor={a.semana} onChange={(v) => mudarSemana(sid, a, v)} />
        <span className="shrink-0 self-center flex justify-center" style={{ width: L.reprog }}>
          {reprog > 0 && (
            <button onClick={() => setVerHistorico(a)} title="Ver as reprogramações"
              className="px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1"
              style={{ background: C.dateSoft, color: C.date }}>
              <History size={12} /> reprogramado {reprog > 1 ? `(${reprog})` : ""}
            </button>
          )}
        </span>
        <button onClick={() => patchAtiv(sid, a.id, { concluida: !a.concluida, concluidaEm: a.concluida ? null : todayBR() })}
          title={a.concluida ? "Reabrir a atividade" : "Marcar como concluída"}
          className="shrink-0 self-center px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
          style={{ background: e.background, color: e.color, width: L.status }}>
          {e.rotulo}
        </button>
        <button onClick={() => patchSecao(sid, { atividades: dados.secoes.find((s) => s.id === sid).atividades.filter((x) => x.id !== a.id) })}
          className="shrink-0 self-center p-1" style={{ color: C.danger }} title="Excluir">
          <X size={14} />
        </button>
      </div>
    );
  };

  const cabecalho = (
    <div className="flex gap-1.5 px-1 pb-1 text-xs font-semibold" style={{ color: "#6B7280" }}>
      <span style={{ width: L.criada }}>Criada</span>
      <span style={{ flex: "1 1 240px", minWidth: 160 }}>Atividade</span>
      <span style={{ width: L.semana }}>Semana</span>
      <span style={{ width: L.reprog }} />
      <span style={{ width: L.status }}>Status</span>
      <span style={{ width: L.lixo }} />
    </div>
  );

  /* Cronograma: junta as atividades de todas as seções, semana a semana. */
  const semanas = [];
  todas.forEach((a) => {
    const k = a.semana || "";
    const g = semanas.find((x) => x.semana === k);
    if (g) g.itens.push(a);
    else semanas.push({ semana: k, itens: [a] });
  });
  semanas.sort((x, y) => chaveSemana(x.semana).localeCompare(chaveSemana(y.semana)));

  return (
    <div className="max-w-5xl mx-auto px-4 py-5">
      <h1 className="text-xl font-semibold mb-1" style={{ color: "#1F2937", fontFamily: "Georgia, serif" }}>
        🤖 MIA — atividades programadas
      </h1>
      <p className="text-xs mb-3" style={{ color: "#9CA3AF" }}>
        As atividades são programadas por semana (qualquer dia que você escolher vira a segunda-feira daquela semana). Mudou a semana, entra como reprogramada e o histórico fica guardado — clique na etiqueta para ver.
      </p>

      <div className="flex items-center gap-2 mb-3 text-xs flex-wrap" style={{ color: "#6B7280" }}>
        <span className="px-2 py-1 rounded-full" style={{ background: "#EEF0F2" }}>{abertas} em aberto</span>
        <span className="px-2 py-1 rounded-full font-semibold" style={{ background: C.stampSoft, color: C.stamp }}>
          {naSemana} nesta semana ({rotuloSemana(semanaAtual()).replace("semana ", "")})
        </span>
        {emAtraso > 0 && (
          <span className="px-2 py-1 rounded-full font-semibold" style={{ background: "#FCEBEB", color: "#A32D2D" }}>{emAtraso} em atraso</span>
        )}
      </div>

      {dados.secoes.map((s) => {
        const pendentes = ordenar(s.atividades.filter((a) => !a.concluida));
        const concluidas = s.atividades.filter((a) => a.concluida);
        const d = draft[s.id] || {};
        return (
          <div key={s.id} className="rounded-xl border shadow-sm p-3 mb-3" style={{ borderColor: C.line, background: C.paper }}>
            <div className="flex items-center gap-2 mb-2">
              <input value={s.nome} onChange={(e) => patchSecao(s.id, { nome: e.target.value })}
                placeholder="Nome da seção"
                className="text-sm font-bold uppercase tracking-wider bg-transparent outline-none flex-1"
                style={{ color: C.stamp }} />
              <span className="text-xs" style={{ color: "#9CA3AF" }}>{pendentes.length} em aberto</span>
              {s.atividades.length === 0 && dados.secoes.length > 1 && (
                <button onClick={() => setSecoes(dados.secoes.filter((x) => x.id !== s.id))}
                  className="text-xs" style={{ color: C.danger }} title="Excluir esta seção (está vazia)">
                  <X size={14} />
                </button>
              )}
            </div>

            {cabecalho}
            {pendentes.length === 0 && concluidas.length === 0 && (
              <p className="px-1 py-2 text-sm" style={{ color: "#9CA3AF" }}>Nenhuma atividade nesta seção ainda.</p>
            )}
            {pendentes.map(linha(s.id))}

            {concluidas.length > 0 && (
              <div className="mt-2 pt-2 border-t" style={{ borderColor: "#EDEDE6" }}>
                <button onClick={() => setVerConcluidas({ ...verConcluidas, [s.id]: !verConcluidas[s.id] })}
                  className="text-xs font-medium" style={{ color: C.stamp }}>
                  {verConcluidas[s.id] ? "▲ esconder" : "▼ mostrar"} concluídas ({concluidas.length})
                </button>
                {verConcluidas[s.id] && ordenar(concluidas).map(linha(s.id))}
              </div>
            )}

            <div className="flex items-stretch gap-1.5 pt-2 mt-2 border-t" style={{ borderColor: "#EDEDE6" }}>
              <span className="shrink-0" style={{ width: L.criada }} />
              <GrowCell value={d.atividade || ""} onChange={(v) => setDraft({ ...draft, [s.id]: { ...d, atividade: v } })}
                onKeyDown={(e) => { if (e.key === "Enter") adicionar(s.id); }}
                placeholder={`Nova atividade em ${s.nome || "esta seção"}…`}
                className={celaCls} style={{ ...celaStyle, flex: "1 1 240px", minWidth: 160 }} />
              <SemanaCampo valor={d.semana || ""} onChange={(v) => setDraft({ ...draft, [s.id]: { ...d, semana: segundaDa(v) } })} />
              <button onClick={() => adicionar(s.id)}
                className="shrink-0 self-center flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                style={{ background: C.stamp }}>
                <Plus size={13} /> Adicionar
              </button>
            </div>
          </div>
        );
      })}

      <button onClick={() => setSecoes([...dados.secoes, { id: uid(), nome: "Nova seção", atividades: [] }])}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium mb-4"
        style={{ background: "#E2E5E9", color: "#374151" }}>
        <Plus size={13} /> Nova seção
      </button>

      <div className="rounded-xl border shadow-sm p-3 mb-3" style={{ borderColor: C.line, background: C.paper }}>
        <p className="text-sm font-bold uppercase tracking-wider mb-2" style={{ color: C.stamp }}>💬 Comentários gerais</p>
        <Comentarios valor={dados.comentarios} onChange={(v) => onChange({ ...dados, comentarios: v })} />
      </div>

      {/* Cronograma: tudo junto, semana a semana */}
      <div className="rounded-xl border shadow-sm p-3" style={{ borderColor: C.line, background: C.paper }}>
        <p className="text-sm font-bold uppercase tracking-wider mb-1" style={{ color: C.stamp }}>📅 Cronograma semanal</p>
        <p className="text-xs mb-3" style={{ color: "#9CA3AF" }}>Todas as seções juntas, na ordem das semanas.</p>
        {semanas.length === 0 && <p className="text-sm" style={{ color: "#9CA3AF" }}>Nada programado ainda.</p>}
        {semanas.map((g) => {
          const atual = g.semana && g.semana === semanaAtual();
          return (
            <div key={g.semana || "sem"} className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={atual ? { background: C.stamp, color: "#fff" } : { background: "#EEF0F2", color: "#4B5563" }}>
                  {g.semana ? rotuloSemana(g.semana) : "sem semana definida"}
                </span>
                {g.semana && <span className="text-xs" style={{ color: "#9CA3AF" }}>{faixaSemana(g.semana)}</span>}
                {atual && <span className="text-xs font-semibold" style={{ color: C.stamp }}>· semana atual</span>}
                <span className="text-xs" style={{ color: "#9CA3AF" }}>· {g.itens.length} atividade{g.itens.length > 1 ? "s" : ""}</span>
              </div>
              {ordenar(g.itens).map((a) => {
                const e = ESTILO[statusDe(a)];
                return (
                  <div key={a.id} className="flex items-start gap-2 py-1 pl-2 text-sm" style={{ color: "#374151" }}>
                    <span className="text-xs px-1.5 py-0.5 rounded shrink-0 mt-0.5" style={{ background: C.mentionSoft, color: C.mention }}>{a.secao}</span>
                    <span className="flex-1" style={{ opacity: a.concluida ? 0.6 : 1 }}>{a.atividade}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold shrink-0" style={{ background: e.background, color: e.color }}>{e.rotulo}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {verHistorico && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(20,23,28,.45)" }}
          onClick={() => setVerHistorico(null)}>
          <div className="rounded-xl border shadow-lg w-full max-w-md p-4" style={{ background: "#fff", borderColor: C.line }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-2 mb-3">
              <p className="flex-1 text-sm font-semibold" style={{ color: "#1F2937" }}>Reprogramações</p>
              <button onClick={() => setVerHistorico(null)} style={{ color: "#9CA3AF" }}><X size={16} /></button>
            </div>
            <p className="text-sm mb-3" style={{ color: "#374151" }}>{verHistorico.atividade}</p>
            <div className="flex flex-col gap-1.5">
              {(verHistorico.historico || []).map((h, i) => (
                <div key={i} className="flex items-center gap-2 text-xs rounded-lg px-2.5 py-2" style={{ background: "#F5F6F7" }}>
                  <span className="w-5 text-right" style={{ color: "#9CA3AF" }}>{i + 1}.</span>
                  <span style={{ color: "#6B7280" }}>da</span>
                  <span className="font-medium" style={{ color: "#374151" }}>{rotuloSemana(h.de)}</span>
                  <span style={{ color: "#6B7280" }}>para a</span>
                  <span className="font-semibold px-1.5 py-0.5 rounded" style={{ background: C.dateSoft, color: C.date }}>{rotuloSemana(h.para)}</span>
                  <span className="flex-1 text-right" style={{ color: "#9CA3AF" }}>em {h.em}</span>
                </div>
              ))}
            </div>
            <p className="text-xs mt-3" style={{ color: "#9CA3AF" }}>
              Agora está na <b style={{ color: C.date }}>{rotuloSemana(verHistorico.semana)}</b>
              {verHistorico.criadaEm ? ` · cadastrada em ${verHistorico.criadaEm}` : ""}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
