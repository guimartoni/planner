import { useMemo, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { C } from "../lib/util.js";
import Avatar from "./Avatar.jsx";

/* Textarea com os comandos @responsável / # prazo / !subtema — usada nos
   blocos de texto dos templates estruturados. */
export function SmartTextarea({ value, onChange, users, sections, placeholder, minH, small }) {
  const taRef = useRef(null);
  const bgRef = useRef(null);
  const [mentionQ, setMentionQ] = useState(null);
  const [tagQ, setTagQ] = useState(null);
  const [datePick, setDatePick] = useState(false);
  const [dateQ, setDateQ] = useState("");
  const [tokenLen, setTokenLen] = useState(0);

  const fmtDate = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  const plusDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
  const parseDateQ = (q) => {
    const m = (q || "").match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if (!m) return null;
    const dd = +m[1], mo = +m[2];
    if (dd < 1 || dd > 31 || mo < 1 || mo > 12) return null;
    const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : new Date().getFullYear();
    return `${String(dd).padStart(2, "0")}/${String(mo).padStart(2, "0")}/${y}`;
  };

  /* Camada colorida atrás do texto: @responsável, !subtema, 📅 prazo e * */
  const escHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const highlighted = useMemo(() => {
    let t = escHtml(value || "");
    [...(users || [])].sort((a, b) => b.name.length - a.name.length).forEach((u) => {
      t = t.split("@" + escHtml(u.name)).join(`<span style="background:${C.mentionSoft};color:${C.mention};border-radius:4px">@${escHtml(u.name)}</span>`);
    });
    [...(sections || [])].sort((a, b) => b.name.length - a.name.length).forEach((s) => {
      t = t.split("!" + escHtml(s.name)).join(`<span style="background:${C.stampSoft};color:${C.stamp};border-radius:4px">!${escHtml(s.name)}</span>`);
    });
    t = t.replace(/📅\s*\d{2}\/\d{2}\/\d{4}/g, (m) => `<span style="background:${C.dateSoft};color:${C.date};border-radius:4px">${m}</span>`);
    t = t.replace(/\*/g, `<span style="color:#EF9F27;font-weight:700">*</span>`);
    if (t.endsWith("\n")) t += "​";
    return t;
  }, [value, users, sections]); // eslint-disable-line

  const handleChange = (e) => {
    const text = e.target.value;
    onChange(text);
    const caret = e.target.selectionStart;
    const before = text.slice(0, caret);
    const mMention = before.match(/(^|\s)@([\wÀ-ÿ]*)$/);
    const mTag = before.match(/(^|\s)!([\wÀ-ÿ]*)$/);
    const mHash = before.match(/(^|\s)#([\d/]{0,10})$/);
    if (mHash) { setDatePick(true); setDateQ(mHash[2]); setTokenLen(mHash[2].length + 1); setMentionQ(null); setTagQ(null); }
    else if (mMention) { setMentionQ(mMention[2]); setTokenLen(mMention[2].length + 1); setDatePick(false); setTagQ(null); }
    else if (mTag) { setTagQ(mTag[2]); setTokenLen(mTag[2].length + 1); setDatePick(false); setMentionQ(null); }
    else { setMentionQ(null); setTagQ(null); setDatePick(false); }
  };

  const replaceToken = (replacement) => {
    const ta = taRef.current;
    const caret = ta.selectionStart;
    const newText = value.slice(0, caret - tokenLen) + replacement + value.slice(caret);
    onChange(newText);
    setMentionQ(null); setTagQ(null); setDatePick(false);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = caret - tokenLen + replacement.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const filtered = (users || []).filter((u) => (mentionQ === null ? false : u.name.toLowerCase().includes(mentionQ.toLowerCase())));

  const inkColor = small ? "#6B7280" : "#1F2937";
  const sizeCls = small ? "text-xs leading-5" : "text-sm leading-7";

  return (
    <div className="relative">
      <div
        ref={bgRef}
        aria-hidden
        className={`${sizeCls} absolute inset-0 whitespace-pre-wrap break-words overflow-hidden pointer-events-none`}
        style={{ color: inkColor }}
        dangerouslySetInnerHTML={{ __html: value ? highlighted : "" }}
      />
      <textarea
        ref={taRef}
        value={value || ""}
        onChange={handleChange}
        onScroll={(e) => { if (bgRef.current) bgRef.current.scrollTop = e.target.scrollTop; }}
        onKeyDown={(e) => {
          if (datePick && (e.key === " " || e.key === "Enter")) {
            const parsed = parseDateQ(dateQ);
            if (parsed) { e.preventDefault(); replaceToken(`📅 ${parsed} `); }
          }
        }}
        placeholder={placeholder}
        className={`relative w-full outline-none resize-none bg-transparent ${sizeCls}`}
        style={{ color: "transparent", caretColor: inkColor, minHeight: minH || (small ? 24 : 120) }}
      />
      {mentionQ !== null && (
        <div className="absolute left-2 top-8 z-20 rounded-xl border shadow-lg overflow-hidden w-64" style={{ background: "#fff", borderColor: C.line }}>
          <p className="px-3 py-1.5 text-xs font-semibold" style={{ background: C.mentionSoft, color: C.mention }}>Delegar para…</p>
          {filtered.length === 0 && <p className="px-3 py-2 text-xs" style={{ color: "#9CA3AF" }}>Ninguém encontrado.</p>}
          {filtered.map((u) => (
            <button key={u.id} onClick={() => replaceToken("@" + u.name + " ")}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50">
              <Avatar user={u} />
              <span className="flex-1">{u.name}</span>
            </button>
          ))}
        </div>
      )}
      {tagQ !== null && (
        <div className="absolute left-2 top-8 z-20 rounded-xl border shadow-lg overflow-hidden w-72" style={{ background: "#fff", borderColor: C.line }}>
          <p className="px-3 py-1.5 text-xs font-semibold" style={{ background: C.stampSoft, color: C.stamp }}>Enviar linha também para…</p>
          {(sections || []).filter((s) => s.name.toLowerCase().includes(tagQ.toLowerCase())).map((s) => (
            <button key={s.secId} onClick={() => replaceToken("!" + s.name + " ")}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50">
              <span className="flex-1 truncate">{s.name}</span>
              <span className="text-xs shrink-0" style={{ color: "#9CA3AF" }}>{s.nbName}</span>
            </button>
          ))}
        </div>
      )}
      {datePick && (
        <div className="absolute left-2 top-8 z-20 rounded-xl border shadow-lg p-3 w-72" style={{ background: "#fff", borderColor: C.line }}>
          <p className="text-xs font-semibold mb-2" style={{ color: C.date }}>
            {parseDateQ(dateQ) ? <>Espaço/Enter confirma <b>📅 {parseDateQ(dateQ)}</b></> : "Prazo: digite 05/08 ou escolha"}
          </p>
          <div className="flex gap-1.5 mb-2 flex-wrap">
            {[["Hoje", 0], ["Amanhã", 1], ["Em 1 semana", 7]].map(([label, n]) => (
              <button key={label} onClick={() => replaceToken(`📅 ${fmtDate(plusDays(n))} `)}
                className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: C.dateSoft, color: C.date }}>
                {label}
              </button>
            ))}
          </div>
          <input type="date"
            onChange={(e) => {
              if (!e.target.value) return;
              const [y, mo, d] = e.target.value.split("-");
              replaceToken(`📅 ${d}/${mo}/${y} `);
            }}
            className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none" style={{ borderColor: C.line }} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
const BlockComment = ({ b, onChange, users, sections }) => (
  <div className="flex items-start gap-1.5 mt-2 pt-2 border-t" style={{ borderColor: "#EDEDE6" }}>
    <span className="text-xs mt-1" title="Comentários — aceita @responsável, # prazo, !subtema e * importante">💬</span>
    <div className="flex-1">
      <SmartTextarea
        small
        value={b.comment || ""}
        onChange={(v) => onChange({ ...b, comment: v })}
        users={users} sections={sections}
        placeholder="Comentários deste bloco… (@ delega · # prazo · ! subtema · * importante)"
      />
    </div>
  </div>
);

const BlockCard = ({ title, hint, extra, children }) => (
  <div className="rounded-xl border shadow-sm" style={{ borderColor: C.line, background: C.paper }}>
    <div className="flex items-center gap-2 px-4 pt-3 pb-1.5 border-b" style={{ borderColor: "#EDEDE6" }}>
      <p className="text-xs font-bold uppercase tracking-wider flex-1" style={{ color: C.stamp }}>{title}</p>
      {extra}
    </div>
    {hint && <p className="px-4 pt-1.5 text-xs" style={{ color: C.date }}>{hint}</p>}
    <div className="p-3">{children}</div>
  </div>
);

function CheckBlock({ b, onChange, users, sections }) {
  return (
    <BlockCard title={b.title}>
      <button
        onClick={() => onChange({ ...b, checked: !b.checked })}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
        style={b.checked ? { background: "#E4F1EB", color: C.stamp } : { background: "#FCEBEB", color: "#A32D2D" }}>
        {b.checked ? <><Check size={15} /> Realizado</> : <><X size={15} /> Não realizado — tocar quando acontecer</>}
      </button>
      <BlockComment b={b} onChange={onChange} users={users} sections={sections} />
    </BlockCard>
  );
}

function MetricBlock({ b, onChange, users, sections }) {
  return (
    <BlockCard title={b.title}>
      <input
        value={b.value || ""}
        onChange={(e) => onChange({ ...b, value: e.target.value })}
        placeholder="0" inputMode="numeric"
        className="w-32 border rounded-lg px-3 py-2 text-2xl font-semibold outline-none"
        style={{ borderColor: "#E3E5DE", background: "#fff", color: C.stamp }}
      />
      <BlockComment b={b} onChange={onChange} users={users} sections={sections} />
    </BlockCard>
  );
}

const cellCls = "border rounded-lg px-2 py-1.5 text-xs outline-none w-full";
const cellStyle = { borderColor: "#E3E5DE", background: "#fff", color: "#374151" };

function ListBlock({ b, onChange, users, sections }) {
  const [draft, setDraft] = useState("");
  const rows = b.rows || [];
  const commit = () => { if (draft.trim()) { onChange({ ...b, rows: [...rows, draft.trim()] }); setDraft(""); } };
  return (
    <BlockCard title={`${b.title} (${rows.length})`} hint={b.hint}>
      <div className="flex flex-col gap-1">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="text-xs w-5 text-right" style={{ color: "#9CA3AF" }}>{i + 1}.</span>
            <input value={r} onChange={(e) => onChange({ ...b, rows: rows.map((x, j) => (j === i ? e.target.value : x)) })}
              className={cellCls} style={cellStyle} />
            <button onClick={() => onChange({ ...b, rows: rows.filter((_, j) => j !== i) })} style={{ color: C.danger }}><X size={13} /></button>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="text-xs w-5 text-right" style={{ color: "#C3C8CF" }}>+</span>
          <input value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); }} onBlur={commit}
            placeholder="Adicionar…" className={cellCls} style={cellStyle} />
        </div>
        <BlockComment b={b} onChange={onChange} users={users} sections={sections} />
      </div>
    </BlockCard>
  );
}

function TableBlock({ b, onChange, onPromote, promoteLabel, users, sections }) {
  const [draft, setDraft] = useState((b.cols || []).map(() => ""));
  const rows = b.rows || [];
  const commit = () => {
    if (draft.some((c) => c.trim())) {
      onChange({ ...b, rows: [...rows, draft.map((c) => c.trim())] });
      setDraft((b.cols || []).map(() => ""));
    }
  };
  /* Colunas de texto esticam para preencher o cartão; número/data têm largura fixa */
  const colStyle = (ci) => {
    const c = (b.cols || [])[ci] || "";
    if (ci === 0) return { flex: "1 1 200px", minWidth: 170 };
    if (/observa|pend|próximo|passo|tema|assunto|coment|previs/i.test(c)) return { flex: "1 1 170px", minWidth: 140 };
    return { width: 130, flexShrink: 0 };
  };
  /* Soma da coluna de volume (R$ M) direto no título */
  const numV = (s) => { const m = String(s || "").replace(",", ".").match(/[\d.]+/); return m ? parseFloat(m[0]) : 0; };
  const fmtV = (n) => String(Math.round(n * 10) / 10).replace(".", ",");
  const volCi = (b.cols || []).findIndex((c) => /volume|valor|\(m\)/i.test(c));
  const volSum = volCi >= 0 ? rows.reduce((a, r) => a + numV(r[volCi]), 0) : 0;
  return (
    <BlockCard title={`${b.title} (${rows.length})${volCi >= 0 && volSum ? ` — total R$ ${fmtV(volSum)}M` : ""}`} hint={b.hint}>
      <div className="overflow-x-auto">
        <div className="flex flex-col gap-1" style={{ minWidth: "fit-content" }}>
          <div className="flex gap-1.5 pl-6 pr-6">
            {b.cols.map((c, i) => (
              <p key={i} className="text-xs font-semibold" style={{ color: "#6B7280", ...colStyle(i) }}>{c}</p>
            ))}
          </div>
          {rows.map((r, ri) => (
            <div key={ri} className="flex items-center gap-1.5">
              <span className="text-xs w-4 text-right shrink-0" style={{ color: "#9CA3AF" }}>{ri + 1}</span>
              {b.cols.map((c, ci) => (
                <input key={ci} value={r[ci] || ""}
                  onChange={(e) => onChange({ ...b, rows: rows.map((x, j) => (j === ri ? x.map((v, k) => (k === ci ? e.target.value : v)) : x)) })}
                  className={cellCls} style={{ ...cellStyle, ...colStyle(ci) }} />
              ))}
              {onPromote && (
                <button onClick={() => onPromote(ri)} className="shrink-0 p-0.5 rounded" title={promoteLabel || "Marcar como realizada"}
                  style={{ color: C.stamp, background: C.stampSoft }}><Check size={13} /></button>
              )}
              <button onClick={() => onChange({ ...b, rows: rows.filter((_, j) => j !== ri) })} className="shrink-0" style={{ color: C.danger }}><X size={13} /></button>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="text-xs w-4 text-right shrink-0" style={{ color: "#C3C8CF" }}>+</span>
            {b.cols.map((c, ci) => (
              <input key={ci} value={draft[ci] || ""}
                onChange={(e) => setDraft(draft.map((v, k) => (k === ci ? e.target.value : v)))}
                onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
                onBlur={() => { if (ci === b.cols.length - 1) commit(); }}
                placeholder={c}
                className={cellCls} style={{ ...cellStyle, ...colStyle(ci) }} />
            ))}
            <span className="w-4 shrink-0" />
          </div>
        </div>
      </div>
      <BlockComment b={b} onChange={onChange} users={users} sections={sections} />
    </BlockCard>
  );
}

function SqlBlock({ b, onChange, users, sections }) {
  const num = (s) => { const m = String(s || "").replace(",", ".").match(/[\d.]+/); return m ? parseFloat(m[0]) : 0; };
  const fmtN = (n) => String(Math.round(n * 10) / 10).replace(".", ",");
  const groups = [["aprovados", "✅ Aprovados", "#1E6B4F"], ["ressalvados", "⚠️ Ressalvados", "#B45309"], ["reprovados", "❌ Reprovados", "#B3372F"]];
  const total = groups.reduce((a, [g]) => a + (b[g] || []).reduce((x, r) => x + num(r[1]), 0), 0);
  return (
    <BlockCard title={`${b.title} — total ${fmtN(total)}M`}
      extra={
        <label className="flex items-center gap-1.5 text-xs" style={{ color: "#6B7280" }}>
          último comitê:
          <input value={b.comite || ""} onChange={(e) => onChange({ ...b, comite: e.target.value })}
            placeholder="DD/MM/AAAA" className="border rounded-lg px-2 py-1 text-xs outline-none w-24" style={cellStyle} />
        </label>
      }>
      <div className="flex flex-col gap-3">
        {groups.map(([g, label, color]) => {
          const rows = b[g] || [];
          const sum = rows.reduce((a, r) => a + num(r[1]), 0);
          return (
            <SqlGroup key={g} label={label} color={color} sum={fmtN(sum)} rows={rows}
              onChange={(nr) => onChange({ ...b, [g]: nr })} />
          );
        })}
      </div>
      <BlockComment b={b} onChange={onChange} users={users} sections={sections} />
    </BlockCard>
  );
}

function SqlGroup({ label, color, sum, rows, onChange }) {
  const [dn, setDn] = useState("");
  const [dv, setDv] = useState("");
  const commit = () => { if (dn.trim()) { onChange([...rows, [dn.trim(), dv.trim()]]); setDn(""); setDv(""); } };
  return (
    <div>
      <p className="text-xs font-semibold mb-1" style={{ color }}>{label} — {sum}M</p>
      <div className="flex flex-col gap-1">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input value={r[0]} onChange={(e) => onChange(rows.map((x, j) => (j === i ? [e.target.value, x[1]] : x)))}
              className={cellCls} style={{ ...cellStyle, flex: "1 1 200px", minWidth: 170 }} />
            <input value={r[1]} onChange={(e) => onChange(rows.map((x, j) => (j === i ? [x[0], e.target.value] : x)))}
              className={cellCls} style={{ ...cellStyle, width: 90, flexShrink: 0 }} placeholder="M" inputMode="decimal" />
            <button onClick={() => onChange(rows.filter((_, j) => j !== i))} style={{ color: C.danger }}><X size={13} /></button>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <input value={dn} onChange={(e) => setDn(e.target.value)} onKeyDown={(e) => e.key === "Enter" && commit()}
            placeholder="Incorporadora" className={cellCls} style={{ ...cellStyle, flex: "1 1 200px", minWidth: 170 }} />
          <input value={dv} onChange={(e) => setDv(e.target.value)} onKeyDown={(e) => e.key === "Enter" && commit()} onBlur={commit}
            placeholder="M" className={cellCls} style={{ ...cellStyle, width: 90, flexShrink: 0 }} inputMode="decimal" />
          <span className="w-4" />
        </div>
      </div>
    </div>
  );
}

function TextBlock({ b, onChange, users, sections }) {
  return (
    <BlockCard title={b.title} hint="Comandos: @responsável · # prazo · !subtema · * importante">
      <SmartTextarea
        value={b.text || ""}
        onChange={(v) => onChange({ ...b, text: v })}
        users={users} sections={sections}
        placeholder="Assuntos gerais, decisões e delegações da reunião…"
        minH={130}
      />
      <BlockComment b={b} onChange={onChange} users={users} sections={sections} />
    </BlockCard>
  );
}

/* Consolidado do mês (Inbound): números somados de todos os FUPs do mês */
function ConsolidadoBlock({ b }) {
  const fmtV = (n) => String(Math.round((n || 0) * 10) / 10).replace(".", ",");
  const v = b.vals || {};
  const items = [
    ["🤝 Reuniões realizadas", v.reunioes, false],
    ["📥 Leads inbound", v.leadsIn, false],
    ["🔁 Leads remarketing", v.leadsRem, false],
    ["✅ SQL aprovados", v.aprovados, true],
    ["⚠️ SQL ressalvados", v.ressalvados, true],
    ["❌ SQL reprovados", v.reprovados, true],
  ];
  return (
    <BlockCard title={`${b.title}${b.mes ? ` — ${b.mes}` : ""}`}
      hint="Somado automaticamente de todos os FUPs de Inbound do mês marcado no cabeçalho da página">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {items.map(([label, val, money]) => (
          <div key={label} className="rounded-lg border px-3 py-2" style={{ borderColor: "#E3E5DE", background: "#fff" }}>
            <p className="text-xs" style={{ color: "#6B7280" }}>{label}</p>
            <p className="text-xl font-semibold" style={{ color: C.stamp }}>
              {money ? `R$ ${fmtV(val)}M` : (val || 0)}
            </p>
          </div>
        ))}
      </div>
    </BlockCard>
  );
}

/* FUP de segunda com o Murilo — data da reunião + tema geral/outros assuntos */
function FupBlock({ b, onChange, users, sections }) {
  return (
    <BlockCard
      title={b.title}
      extra={
        <label className="flex items-center gap-1.5 text-xs" style={{ color: "#6B7280" }}>
          data:
          <input value={b.date || ""} onChange={(e) => onChange({ ...b, date: e.target.value })}
            placeholder="DD/MM/AAAA" className="border rounded-lg px-2 py-1 text-xs outline-none w-24" style={cellStyle} />
        </label>
      }
      hint="Comandos: @responsável · # prazo · !subtema · * importante">
      <SmartTextarea
        value={b.text || ""}
        onChange={(v) => onChange({ ...b, text: v })}
        users={users} sections={sections}
        placeholder="Tema geral / outros assuntos do FUP com o Murilo…"
        minH={110}
      />
      <BlockComment b={b} onChange={onChange} users={users} sections={sections} />
    </BlockCard>
  );
}

export function BlocksEditor({ blocks, onChange, users, sections }) {
  const patch = (i, nb) => onChange(blocks.map((b, j) => (j === i ? nb : b)));

  // "virou realizada": mover linha para o bloco de realizadas correspondente
  const promoteTargets = (b) => {
    if (b.type !== "table") return null;
    if (/VISITAS AGENDADAS/i.test(b.title)) {
      const dest = blocks.find((x) => x.type === "list" && /REALIZADAS/i.test(x.title));
      return dest ? { dest, kind: "list", label: "Marcar como realizada" } : null;
    }
    if (/A REALIZAR/i.test(b.title) && /CALL/i.test(b.title)) {
      const dest = blocks.find((x) => x.type === "table" && /REALIZADAS/i.test(x.title) && /CALL|PIPE/i.test(x.title));
      return dest ? { dest, kind: "table", label: "Marcar como realizada" } : null;
    }
    return null;
  };
  const promoteRow = (bi, ri) => {
    const b = blocks[bi];
    const tgt = promoteTargets(b);
    if (!tgt) return;
    const row = (b.rows || [])[ri];
    if (!row) return;
    onChange(blocks.map((x, j) => {
      if (j === bi) return { ...x, rows: x.rows.filter((_, k) => k !== ri) };
      if (x.id === tgt.dest.id) {
        if (tgt.kind === "list") return { ...x, rows: [...(x.rows || []), row[0]] };
        const cols = tgt.dest.cols || [];
        const newRow = cols.map((c, ci) => (ci === 0 ? row[0] : ci === cols.length - 1 ? (row[1] || "") : ""));
        return { ...x, rows: [...(x.rows || []), newRow] };
      }
      return x;
    }));
  };

  return (
    <div className="flex flex-col gap-3">
      {blocks.map((b, i) => {
        if (b.type === "metric") return <MetricBlock key={b.id} b={b} onChange={(nb) => patch(i, nb)} users={users} sections={sections} />;
        if (b.type === "check") return <CheckBlock key={b.id} b={b} onChange={(nb) => patch(i, nb)} users={users} sections={sections} />;
        if (b.type === "list") return <ListBlock key={b.id} b={b} onChange={(nb) => patch(i, nb)} users={users} sections={sections} />;
        if (b.type === "table") return <TableBlock key={b.id} b={b} onChange={(nb) => patch(i, nb)} users={users} sections={sections}
          onPromote={promoteTargets(b) ? (ri) => promoteRow(i, ri) : null} promoteLabel={(promoteTargets(b) || {}).label} />;
        if (b.type === "sql") return <SqlBlock key={b.id} b={b} onChange={(nb) => patch(i, nb)} users={users} sections={sections} />;
        if (b.type === "fup") return <FupBlock key={b.id} b={b} onChange={(nb) => patch(i, nb)} users={users} sections={sections} />;
        if (b.type === "consolidado") return <ConsolidadoBlock key={b.id} b={b} />;
        return <TextBlock key={b.id} b={b} onChange={(nb) => patch(i, nb)} users={users} sections={sections} />;
      })}
    </div>
  );
}
