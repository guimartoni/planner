import { useRef } from "react";
import { Plus, X } from "lucide-react";
import { C, uid } from "../lib/util.js";
import { useAutoGrow } from "../lib/autoGrow.js";
import { PRODUTOS, fmtR, pct, projecaoAcao, resumoDemanda } from "../lib/demanda.js";
import { BlockCard, BlockComment, GrowCell } from "./Blocks.jsx";

/* Blocos do FUP de Geração de Demanda: canal (metas, realizado e ações com
   custo) e o painel da semana com a projeção do mês. Regras em lib/demanda.js. */

const cel = "border rounded-lg px-2 py-1.5 text-xs outline-none w-full";
const celStyle = { borderColor: "#E3E5DE", background: "#fff", color: "#374151" };
const PROD_COR = {
  Capital: { background: "#E3ECF7", color: "#2E6BB0" },
  Advisor: { background: "#ECE8F6", color: "#5B4A9E" },
  "Capital + Advisor": { background: "#E4F1EB", color: "#1E6B4F" },
};

function Diretriz({ value, onChange }) {
  const ref = useRef(null);
  useAutoGrow(ref, value, { modo: "minimo" });
  return (
    <textarea ref={ref} rows={1} value={value || ""} onChange={(e) => onChange(e.target.value)}
      placeholder="Diretriz / plano combinado…"
      className={cel + " text-sm leading-6 resize-none overflow-hidden"} style={{ ...celStyle, width: "100%", minHeight: 40 }} />
  );
}

/* barrinha de atingimento da meta */
function Meta({ rotulo, meta, real, onMeta, onReal, cor }) {
  const p = pct(Number(String(real).replace(",", ".")) || 0, Number(String(meta).replace(",", ".")) || 0);
  return (
    <div className="flex-1 min-w-[220px] rounded-lg border px-3 py-2" style={{ borderColor: "#E3E5DE", background: "#fff" }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={PROD_COR[rotulo]}>{rotulo}</span>
        {p !== null && (
          <span className="text-xs font-semibold" style={{ color: p >= 100 ? C.stamp : p >= 60 ? C.date : C.danger }}>{p}% da meta</span>
        )}
      </div>
      <div className="flex items-end gap-2">
        <label className="flex-1">
          <span className="block text-xs" style={{ color: "#9CA3AF" }}>Meta semanal</span>
          <input value={meta} onChange={(e) => onMeta(e.target.value)} inputMode="numeric" placeholder="0"
            className="w-full border rounded-lg px-2 py-1 text-lg font-semibold outline-none" style={{ ...celStyle, color: "#6B7280" }} />
        </label>
        <label className="flex-1">
          <span className="block text-xs" style={{ color: "#9CA3AF" }}>Realizadas</span>
          <input value={real} onChange={(e) => onReal(e.target.value)} inputMode="numeric" placeholder="0"
            className="w-full border rounded-lg px-2 py-1 text-lg font-semibold outline-none" style={{ ...celStyle, color: cor }} />
        </label>
      </div>
      {p !== null && (
        <div className="h-1.5 rounded-full mt-2 overflow-hidden" style={{ background: "#EEF0F2" }}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, p)}%`, background: p >= 100 ? C.stamp : p >= 60 ? "#E8B45A" : "#E0635C" }} />
        </div>
      )}
    </div>
  );
}

export function CanalBlock({ b, onChange, users, sections, vals }) {
  const acoes = b.acoes || [];
  const setAcao = (id, campos) => onChange({ ...b, acoes: acoes.map((a) => (a.id === id ? { ...a, ...campos } : a)) });
  const linha = resumoDemanda([b], vals).canais[0];
  return (
    <BlockCard
      title={<span className="flex items-center gap-2 flex-wrap">{b.title}
        <span className="normal-case tracking-normal text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: C.stampSoft, color: C.stamp }}
          title="Soma do custo previsto das ações deste canal">
          {fmtR(linha.custo)}/semana · {fmtR(linha.projecao)} no mês
        </span>
      </span>}
      extra={
        <label className="flex items-center gap-1 text-xs cursor-pointer" style={{ color: "#6B7280" }}>
          <input type="checkbox" checked={!!b.naoAplica} onChange={(e) => onChange({ ...b, naoAplica: e.target.checked })} />
          sem meta de reuniões
        </label>
      }>
      {!b.naoAplica && (
        <div className="flex flex-wrap gap-2 mb-3">
          <Meta rotulo="Capital" meta={b.meta.capital} real={b.real.capital} cor="#2E6BB0"
            onMeta={(v) => onChange({ ...b, meta: { ...b.meta, capital: v } })}
            onReal={(v) => onChange({ ...b, real: { ...b.real, capital: v } })} />
          <Meta rotulo="Advisor" meta={b.meta.advisor} real={b.real.advisor} cor="#5B4A9E"
            onMeta={(v) => onChange({ ...b, meta: { ...b.meta, advisor: v } })}
            onReal={(v) => onChange({ ...b, real: { ...b.real, advisor: v } })} />
        </div>
      )}

      {acoes.map((a) => {
        const proj = projecaoAcao(a, vals);
        return (
          <div key={a.id} className="rounded-lg border p-2 mb-2" style={{ borderColor: "#E3E5DE", background: "#FCFCFA" }}>
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <GrowCell value={a.nome} onChange={(v) => setAcao(a.id, { nome: v })} placeholder="Nome da ação"
                className={cel + " font-semibold text-sm"} style={{ ...celStyle, flex: "1 1 220px", minWidth: 180 }} />
              <select value={a.produto || ""} onChange={(e) => setAcao(a.id, { produto: e.target.value })}
                className="border rounded-lg px-1.5 py-1.5 text-xs outline-none shrink-0"
                style={{ ...celStyle, width: 140, ...(PROD_COR[a.produto] || {}) }}>
                <option value="">— produto</option>
                {PRODUTOS.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
              <span className="flex items-center gap-1 shrink-0">
                <span className="text-xs" style={{ color: "#9CA3AF" }}>Custo</span>
                <input value={a.custo || ""} onChange={(e) => setAcao(a.id, { custo: e.target.value })} placeholder="R$ 0"
                  inputMode="decimal" className={cel} style={{ ...celStyle, width: 82 }} />
                <select value={a.periodo || "semana"} onChange={(e) => setAcao(a.id, { periodo: e.target.value })}
                  className="border rounded-lg px-1 py-1.5 text-xs outline-none" style={{ ...celStyle, width: 86 }}
                  title="Custo por semana ou uma vez no mês">
                  <option value="semana">por semana</option>
                  <option value="mes">no mês</option>
                </select>
              </span>
              <span className="shrink-0 text-xs px-2 py-1.5 rounded-lg whitespace-nowrap" style={{ background: "#EEF0F2", color: "#4B5563" }}
                title="Custo semanal × semanas do mês (ou o custo único, quando é no mês)">
                No mês <b>{proj ? fmtR(proj) : "—"}</b>
              </span>
              <button onClick={() => onChange({ ...b, acoes: acoes.filter((x) => x.id !== a.id) })}
                className="shrink-0 p-1 ml-auto" style={{ color: C.danger }} title="Excluir ação">
                <X size={14} />
              </button>
            </div>
            <Diretriz value={a.diretriz} onChange={(v) => setAcao(a.id, { diretriz: v })} />
          </div>
        );
      })}
      <div className="flex items-center gap-2 mt-2">
        <button onClick={() => onChange({ ...b, acoes: [...acoes, { id: uid(), nome: "", produto: "", diretriz: "", custo: "", periodo: "semana" }] })}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium" style={{ background: "#E2E5E9", color: "#374151" }}>
          <Plus size={12} /> Ação
        </button>
      </div>
      <BlockComment b={b} onChange={onChange} users={users} sections={sections} />
    </BlockCard>
  );
}

const Num = ({ rotulo, valor, sub, cor }) => (
  <div className="rounded-lg border px-3 py-2" style={{ borderColor: "#E3E5DE", background: "#fff" }}>
    <p className="text-xs" style={{ color: "#6B7280" }}>{rotulo}</p>
    <p className="text-xl font-semibold" style={{ color: cor || C.stamp }}>{valor}</p>
    {sub && <p className="text-xs" style={{ color: "#9CA3AF" }}>{sub}</p>}
  </div>
);

export function DemandaResumoBlock({ b, blocks }) {
  const r = resumoDemanda(blocks, b.vals);
  const v = b.vals || {};
  const pc = (x, m) => { const p = pct(x, m); return p === null ? "" : ` · ${p}%`; };
  return (
    <BlockCard title={`${b.title}${b.mes ? ` — ${b.mes}` : ""}`}
      hint={`Calculado sozinho a partir dos canais abaixo. Reuniões do mês = soma dos FUPs do mês (${v.semanasMes || "?"} semanas).`}>
      <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#6B7280" }}>Reuniões</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
        <Num rotulo="Capital na semana" valor={`${r.semana.realC} / ${r.semana.metaC}`} sub={`realizadas / meta${pc(r.semana.realC, r.semana.metaC)}`} cor="#2E6BB0" />
        <Num rotulo="Advisor na semana" valor={`${r.semana.realA} / ${r.semana.metaA}`} sub={`realizadas / meta${pc(r.semana.realA, r.semana.metaA)}`} cor="#5B4A9E" />
        <Num rotulo="Capital no mês" valor={`${r.mes.realC} / ${r.mes.metaC}`} sub={`acumulado / meta do mês${pc(r.mes.realC, r.mes.metaC)}`} cor="#2E6BB0" />
        <Num rotulo="Advisor no mês" valor={`${r.mes.realA} / ${r.mes.metaA}`} sub={`acumulado / meta do mês${pc(r.mes.realA, r.mes.metaA)}`} cor="#5B4A9E" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#6B7280" }}>Custos</p>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Num rotulo="Custo previsto da semana" valor={fmtR(r.semana.custo)} sub="soma das ações por semana" />
        <Num rotulo="Projeção de custo do mês" valor={fmtR(r.mes.projecao)} sub={`custo semanal × ${v.semanasMes || 4} semanas + custos únicos do mês`} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ color: "#6B7280" }}>
              {["Canal", "Capital (real/meta)", "Advisor (real/meta)", "Custo previsto /semana", "Projeção do mês"].map((h) => (
                <th key={h} className="text-left font-semibold px-2 py-1 border-b whitespace-nowrap" style={{ borderColor: C.line }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {r.canais.map((c) => (
              <tr key={c.id} style={{ color: "#374151" }}>
                <td className="px-2 py-1.5 border-b font-semibold whitespace-nowrap" style={{ borderColor: "#EDEDE6" }}>{c.title}</td>
                <td className="px-2 py-1.5 border-b" style={{ borderColor: "#EDEDE6" }}>{c.naoAplica ? "—" : `${c.realC} / ${c.metaC}`}</td>
                <td className="px-2 py-1.5 border-b" style={{ borderColor: "#EDEDE6" }}>{c.naoAplica ? "—" : `${c.realA} / ${c.metaA}`}</td>
                <td className="px-2 py-1.5 border-b" style={{ borderColor: "#EDEDE6" }}>{fmtR(c.custo)}</td>
                <td className="px-2 py-1.5 border-b font-semibold" style={{ borderColor: "#EDEDE6" }}>{fmtR(c.projecao)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BlockCard>
  );
}
