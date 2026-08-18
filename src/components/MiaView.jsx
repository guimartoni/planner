import { useState } from "react";
import { History, Plus, X } from "lucide-react";
import { C, dateKeyBR, todayBR, uid } from "../lib/util.js";
import { DateBR, GrowCell } from "./Blocks.jsx";

/* Aba da MIA: controle das atividades programadas.

   Cada atividade tem uma data de execução. Se a data mudar, o app guarda a
   troca no histórico e marca a linha como REPROGRAMADA — o histórico abre num
   pop-up. O status ao lado sai sozinho da data: concluída, em atraso (data já
   passou) ou a executar. */

export const statusDe = (a) => {
  if (a.concluida) return "concluido";
  if (a.data && dateKeyBR(a.data) < dateKeyBR(todayBR())) return "atraso";
  return "a-executar";
};

const ESTILO = {
  concluido: { rotulo: "✅ Concluído", background: C.stampSoft, color: C.stamp },
  atraso: { rotulo: "⚠️ Atraso", background: "#FCEBEB", color: "#A32D2D" },
  "a-executar": { rotulo: "🕒 A executar", background: "#EEF0F2", color: "#4B5563" },
};

const celaCls = "border rounded-lg px-2 py-1.5 text-sm outline-none w-full";
const celaStyle = { borderColor: "#E3E5DE", background: "#fff", color: "#374151" };

export default function MiaView({ atividades, onChange }) {
  const [draft, setDraft] = useState({ atividade: "", data: "" });
  const [verHistorico, setVerHistorico] = useState(null);
  const [verConcluidas, setVerConcluidas] = useState(false);

  const lista = atividades || [];
  const patch = (id, campos) => onChange(lista.map((a) => (a.id === id ? { ...a, ...campos } : a)));

  /* Trocar a data é uma reprogramação: guarda de-para e a data em que mudou. */
  const mudarData = (a, nova) => {
    if ((a.data || "") === (nova || "")) return;
    const historico = a.data && nova
      ? [...(a.historico || []), { de: a.data, para: nova, em: todayBR() }]
      : (a.historico || []);
    patch(a.id, { data: nova, historico });
  };

  const adicionar = () => {
    if (!draft.atividade.trim()) return;
    onChange([...lista, {
      id: uid(), atividade: draft.atividade.trim(), data: draft.data,
      concluida: false, historico: [],
    }]);
    setDraft({ atividade: "", data: "" });
  };

  const ordem = { atraso: 0, "a-executar": 1, concluido: 2 };
  const pendentes = lista.filter((a) => !a.concluida).sort((x, y) => {
    const s = ordem[statusDe(x)] - ordem[statusDe(y)];
    if (s) return s;
    return (dateKeyBR(x.data) || "99999999").localeCompare(dateKeyBR(y.data) || "99999999");
  });
  const concluidas = lista.filter((a) => a.concluida);
  const emAtraso = pendentes.filter((a) => statusDe(a) === "atraso").length;

  const linha = (a) => {
    const st = statusDe(a);
    const e = ESTILO[st];
    const reprog = (a.historico || []).length;
    return (
      <div key={a.id} className="flex items-stretch gap-1.5 py-1">
        <GrowCell value={a.atividade} onChange={(v) => patch(a.id, { atividade: v })}
          className={celaCls} style={{ ...celaStyle, flex: "1 1 260px", minWidth: 180, opacity: a.concluida ? 0.6 : 1 }} />
        <DateBR value={a.data} onChange={(v) => mudarData(a, v)}
          className={celaCls} style={{ ...celaStyle, width: 150, flexShrink: 0 }} />
        <span className="shrink-0 self-center flex justify-center" style={{ width: 128 }}>
          {reprog > 0 && (
            <button onClick={() => setVerHistorico(a)} title="Ver as reprogramações"
              className="px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1"
              style={{ background: C.dateSoft, color: C.date }}>
              <History size={12} /> reprogramado {reprog > 1 ? `(${reprog})` : ""}
            </button>
          )}
        </span>
        <button onClick={() => patch(a.id, { concluida: !a.concluida, concluidaEm: a.concluida ? null : todayBR() })}
          title={a.concluida ? "Reabrir a atividade" : "Marcar como concluída"}
          className="shrink-0 self-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
          style={{ background: e.background, color: e.color, width: 120 }}>
          {e.rotulo}
        </button>
        <button onClick={() => onChange(lista.filter((x) => x.id !== a.id))}
          className="shrink-0 self-center p-1" style={{ color: C.danger }} title="Excluir">
          <X size={14} />
        </button>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-5">
      <h1 className="text-xl font-semibold mb-1" style={{ color: "#1F2937", fontFamily: "Georgia, serif" }}>
        🤖 MIA — atividades programadas
      </h1>
      <p className="text-xs mb-4" style={{ color: "#9CA3AF" }}>
        Cada atividade tem uma data de execução. Se você mudar a data, ela entra como reprogramada e o histórico fica guardado — é só clicar na etiqueta para ver. O status ao lado sai sozinho da data.
      </p>

      <div className="flex items-center gap-2 mb-3 text-xs" style={{ color: "#6B7280" }}>
        <span className="px-2 py-1 rounded-full" style={{ background: "#EEF0F2" }}>
          {pendentes.length} em aberto
        </span>
        {emAtraso > 0 && (
          <span className="px-2 py-1 rounded-full font-semibold" style={{ background: "#FCEBEB", color: "#A32D2D" }}>
            {emAtraso} em atraso
          </span>
        )}
        {concluidas.length > 0 && (
          <span className="px-2 py-1 rounded-full" style={{ background: C.stampSoft, color: C.stamp }}>
            {concluidas.length} concluídas
          </span>
        )}
      </div>

      <div className="rounded-xl border shadow-sm p-3" style={{ borderColor: C.line, background: C.paper }}>
        <div className="flex gap-1.5 px-1 pb-1 text-xs font-semibold" style={{ color: "#6B7280" }}>
          <span style={{ flex: "1 1 260px", minWidth: 180 }}>Atividade</span>
          <span style={{ width: 150 }}>Data de execução</span>
          <span style={{ width: 128 }} />
          <span style={{ width: 120 }}>Status</span>
          <span style={{ width: 22 }} />
        </div>

        {pendentes.length === 0 && concluidas.length === 0 && (
          <p className="px-1 py-3 text-sm" style={{ color: "#9CA3AF" }}>
            Nenhuma atividade programada ainda — cadastre a primeira abaixo.
          </p>
        )}
        {pendentes.map(linha)}

        {concluidas.length > 0 && (
          <div className="mt-2 pt-2 border-t" style={{ borderColor: "#EDEDE6" }}>
            <button onClick={() => setVerConcluidas(!verConcluidas)} className="text-xs font-medium" style={{ color: C.stamp }}>
              {verConcluidas ? "▲ esconder" : "▼ mostrar"} concluídas ({concluidas.length})
            </button>
            {verConcluidas && concluidas.map(linha)}
          </div>
        )}

        {/* nova atividade */}
        <div className="flex items-stretch gap-1.5 pt-2 mt-2 border-t" style={{ borderColor: "#EDEDE6" }}>
          <GrowCell value={draft.atividade} onChange={(v) => setDraft({ ...draft, atividade: v })}
            onKeyDown={(e) => { if (e.key === "Enter") adicionar(); }}
            placeholder="Nova atividade da MIA…"
            className={celaCls} style={{ ...celaStyle, flex: "1 1 260px", minWidth: 180 }} />
          <DateBR value={draft.data} onChange={(v) => setDraft({ ...draft, data: v })}
            className={celaCls} style={{ ...celaStyle, width: 150, flexShrink: 0 }} />
          <button onClick={adicionar}
            className="shrink-0 self-center flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
            style={{ background: C.stamp }}>
            <Plus size={13} /> Adicionar
          </button>
        </div>
      </div>

      {/* pop-up das reprogramações */}
      {verHistorico && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(20,23,28,.45)" }}
          onClick={() => setVerHistorico(null)}>
          <div className="rounded-xl border shadow-lg w-full max-w-md p-4" style={{ background: "#fff", borderColor: C.line }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-2 mb-3">
              <p className="flex-1 text-sm font-semibold" style={{ color: "#1F2937" }}>
                Reprogramações
              </p>
              <button onClick={() => setVerHistorico(null)} style={{ color: "#9CA3AF" }}><X size={16} /></button>
            </div>
            <p className="text-sm mb-3" style={{ color: "#374151" }}>{verHistorico.atividade}</p>
            <div className="flex flex-col gap-1.5">
              {(verHistorico.historico || []).map((h, i) => (
                <div key={i} className="flex items-center gap-2 text-xs rounded-lg px-2.5 py-2" style={{ background: "#F5F6F7" }}>
                  <span className="w-5 text-right" style={{ color: "#9CA3AF" }}>{i + 1}.</span>
                  <span style={{ color: "#6B7280" }}>de</span>
                  <span className="font-medium" style={{ color: "#374151" }}>{h.de}</span>
                  <span style={{ color: "#6B7280" }}>para</span>
                  <span className="font-semibold px-1.5 py-0.5 rounded" style={{ background: C.dateSoft, color: C.date }}>{h.para}</span>
                  <span className="flex-1 text-right" style={{ color: "#9CA3AF" }}>em {h.em}</span>
                </div>
              ))}
            </div>
            <p className="text-xs mt-3" style={{ color: "#9CA3AF" }}>
              Data atual: <b style={{ color: C.date }}>{verHistorico.data || "sem data"}</b>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
