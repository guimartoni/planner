import { consolidadoEff, consolidadoItems } from "../lib/blocks.js";

/* Painel visual do FUP — renderiza TODOS os blocos preenchidos, na ordem
   do template, com deltas vs semana anterior. Funciona para Farming,
   Inbound, Parcerias e qualquer template futuro. */
export default function FupPanel({ blocks, prevBlocks, header, showEmpty }) {
  const num = (s) => { const m = String(s || "").replace(",", ".").match(/[\d.]+/); return m ? parseFloat(m[0]) : 0; };
  const fmtN = (n) => String(Math.round(n * 10) / 10).replace(".", ",");
  const findPrev = (b) => b && (prevBlocks || []).find((x) => x.id === b.id || x.title === b.title);
  const names = (b) => ((b && b.rows) || []).map((r) => (Array.isArray(r) ? r[0] : r)).filter(Boolean);
  const colIdx = (b, re) => (b && b.cols ? b.cols.findIndex((c) => re.test(c)) : -1);
  const sumCol = (b, re) => { const i = colIdx(b, re); return i < 0 ? 0 : ((b.rows || []).reduce((a, r) => a + num(r[i]), 0)); };

  const D = {
    bg: "#14171C", card: "#1D2127", line: "#2B313A",
    text: "#E6E8EB", sub: "#B7BDC6", mut: "#8B919A",
    green: "#3FBF7F", greenBg: "rgba(63,191,127,.14)",
    amber: "#E8B45A", amberBg: "rgba(232,180,90,.14)",
    red: "#E0635C", redBg: "rgba(224,99,92,.14)",
    blue: "#6FA8E8", blueBg: "rgba(111,168,232,.14)",
  };

  const Card = ({ title, sub, children }) => (
    <div className="rounded-xl border p-4 mb-3 break-inside-avoid" style={{ borderColor: D.line, background: D.card }}>
      <p className="text-sm font-semibold mb-2.5" style={{ color: D.text }}>
        {title}{sub && <span className="font-normal ml-1.5" style={{ color: D.mut }}>· {sub}</span>}
      </p>
      {children}
    </div>
  );
  const Row = ({ children, last }) => (
    <div className="flex items-center gap-2 py-1.5 text-sm" style={{ borderBottom: last ? "none" : `0.5px solid ${D.line}`, color: D.sub }}>
      {children}
    </div>
  );
  const Badge = ({ bg, color, children }) => (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0" style={{ background: bg, color }}>{children}</span>
  );
  const Comment = ({ b }) => (b.comment && b.comment.trim()
    ? <p className="text-xs mt-2 whitespace-pre-wrap" style={{ color: D.mut }}>💬 {b.comment.trim()}</p>
    : null);
  const SemInfo = () => <p className="text-sm italic" style={{ color: D.mut }}>— sem informações</p>;
  const dSort = (rows, di) => [...rows].sort((a, b) => {
    const k = (r) => { const m = String(r[di] || "").match(/(\d{1,2})\/(\d{1,2})/); return m ? `${m[2].padStart(2, "0")}${m[1].padStart(2, "0")}` : "9999"; };
    return k(a).localeCompare(k(b));
  });

  const Delta = ({ cur, prev, money }) => {
    if (prev === null || prev === undefined) return null;
    const d = cur - prev;
    if (!d) return <span className="text-xs ml-1.5" style={{ color: D.mut }}>=</span>;
    return (
      <span className="text-xs ml-1.5 font-semibold" style={{ color: d > 0 ? D.green : D.red }}>
        {d > 0 ? "▲" : "▼"} {money ? fmtN(Math.abs(d)) + "M" : Math.abs(d)}
      </span>
    );
  };

  /* ---------- KPIs do topo ---------- */
  const B = blocks || [];
  const findT = (re, type) => B.find((b) => (type ? b.type === type : true) && re.test(b.title));
  const kpis = [];
  B.filter((b) => b.type === "metric").forEach((mb) => {
    const p = findPrev(mb);
    if (String(mb.value || "").trim() || p) kpis.push({ label: mb.title.replace(/^[^0-9A-Za-zÀ-ÿ]+\s*/, ""), cur: num(mb.value), prev: p ? num(p.value) : null });
  });
  B.filter((b) => b.type === "reunioes").forEach((rb) => {
    const p = findPrev(rb);
    kpis.push({ label: "Reuniões agendadas", cur: num(rb.agendadas), prev: p ? num(p.agendadas) : null });
    kpis.push({ label: "Reuniões realizadas", cur: num(rb.realizadas), prev: p ? num(p.realizadas) : null });
  });
  B.filter((b) => b.type === "leads").forEach((lb) => {
    const p = findPrev(lb);
    kpis.push({ label: "Leads inbound", cur: num(lb.inbound), prev: p ? num(p.inbound) : null });
    kpis.push({ label: "Leads remarketing", cur: num(lb.remarketing), prev: p ? num(p.remarketing) : null });
  });
  const realiz = findT(/VISITAS REALIZADAS/i) || findT(/REALIZADAS NA SEMANA/i, "list");
  const agend = findT(/VISITAS AGENDADAS/i, "table");
  const pipeR = findT(/PIPE REALIZADAS/i, "table");
  const callsPar = findT(/CALLS.*PARCEIR/i, "table");
  const callsCli = findT(/CALLS.*CLIENTE/i, "table");
  const novosPar = findT(/NOVOS PARCEIROS/i);
  const apres = findT(/A APRESENTAR/i, "table");
  if (realiz) kpis.push({ label: "Visitas realizadas", cur: names(realiz).length, prev: findPrev(realiz) ? names(findPrev(realiz)).length : null });
  if (agend) kpis.push({ label: "Visitas agendadas", cur: names(agend).length, prev: findPrev(agend) ? names(findPrev(agend)).length : null });
  if (pipeR) kpis.push({ label: "Ops mapeadas", cur: sumCol(pipeR, /opera|n[ºo]/i), prev: findPrev(pipeR) ? sumCol(findPrev(pipeR), /opera|n[ºo]/i) : null });
  if (callsPar) kpis.push({ label: "Calls c/ parceiros", cur: (callsPar.rows || []).length, prev: findPrev(callsPar) ? (findPrev(callsPar).rows || []).length : null });
  if (callsCli) kpis.push({ label: "Calls c/ clientes", cur: (callsCli.rows || []).length, prev: findPrev(callsCli) ? (findPrev(callsCli).rows || []).length : null });
  if (novosPar) kpis.push({ label: "Novos parceiros", cur: names(novosPar).length, prev: findPrev(novosPar) ? names(findPrev(novosPar)).length : null });
  if (apres) kpis.push({ label: "SQL a apresentar", cur: sumCol(apres, /volume|\(m\)/i), prev: findPrev(apres) ? sumCol(findPrev(apres), /volume|\(m\)/i) : null, money: true });

  /* ---------- um card por bloco, na ordem do template ---------- */
  const renderList = (b) => {
    const rows = (b.rows || []).filter(Boolean);
    if (!rows.length && !(b.comment || "").trim() && !showEmpty) return null;
    return (
      <Card key={b.id} title={b.title} sub={rows.length ? `${rows.length}` : null}>
        {rows.length === 0 && <SemInfo />}
        {rows.map((n, i) => (
          <Row key={i} last={i === rows.length - 1}>
            <span className="flex-1 break-words" style={{ color: D.text }}>{n}</span>
          </Row>
        ))}
        <Comment b={b} />
      </Card>
    );
  };

  const renderTable = (b) => {
    const rows = (b.rows || []).filter((r) => (r || []).some(Boolean));
    if (!rows.length && !(b.comment || "").trim() && !showEmpty) return null;
    const dateCi = colIdx(b, /data/i);
    const sorted = /AGENDADAS/i.test(b.title) && dateCi > 0 ? dSort(rows, dateCi) : rows;
    const opsCi = colIdx(b, /opera|n[ºo]/i);
    const volCi = colIdx(b, /volume|valor|\(m\)/i);
    const sub = opsCi > 0 ? `${rows.length} · ${fmtN(rows.reduce((a, r) => a + num(r[opsCi]), 0))} operações`
      : volCi > 0 ? `R$ ${fmtN(rows.reduce((a, r) => a + num(r[volCi]), 0))}M em ${rows.length}`
        : `${rows.length}`;
    return (
      <Card key={b.id} title={b.title} sub={rows.length ? sub : null}>
        {rows.length === 0 && <SemInfo />}
        {sorted.map((r, i) => {
          const extras = (b.cols || []).slice(1)
            .map((c, j) => ({ c, v: String(r[j + 1] || "").trim() }))
            .filter((x) => x.v);
          const longas = extras.filter((x) => /pend|observa/i.test(x.c));
          const curtas = extras.filter((x) => !/pend|observa/i.test(x.c));
          return (
            <div key={i} className="py-1.5 text-sm"
              style={{ borderBottom: i === sorted.length - 1 ? "none" : `0.5px solid ${D.line}`, color: D.sub }}>
              <div className="flex items-baseline gap-2">
                <span className="flex-1 break-words" style={{ color: D.text }}>{r[0]}</span>
                {curtas.map((x, j) => <span key={j} className="text-xs shrink-0" style={{ color: D.sub }}>{x.v}</span>)}
              </div>
              {longas.map((x, j) => (
                <p key={j} className="text-xs mt-0.5 whitespace-pre-wrap" style={{ color: D.amber }}>↳ {x.v}</p>
              ))}
            </div>
          );
        })}
        <Comment b={b} />
      </Card>
    );
  };

  const renderCheck = (b) => (
    <Card key={b.id} title={b.title}>
      {b.checked
        ? <Badge bg={D.greenBg} color={D.green}>✓ Realizado</Badge>
        : <Badge bg={D.redBg} color={D.red}>✗ Não realizado</Badge>}
      <Comment b={b} />
    </Card>
  );

  const renderMetric = (b) => {
    // o valor já está nos KPIs do topo; o card aparece se houver comentário
    // ou (na ata) se estiver sem valor, para registrar "sem informações"
    const vazio = !String(b.value || "").trim();
    if (!(b.comment || "").trim() && !(showEmpty && vazio)) return null;
    return (
      <Card key={b.id} title={b.title} sub={vazio ? null : String(b.value)}>
        {vazio && <SemInfo />}
        <Comment b={b} />
      </Card>
    );
  };

  const renderSql = (b) => {
    const total = ["aprovados", "ressalvados", "reprovados"].reduce((a, g) => a + (b[g] || []).reduce((x, r) => x + num(r[1]), 0), 0);
    if (!total && !(b.comment || "").trim() && !showEmpty) return null;
    return (
      <Card key={b.id} title={b.title} sub={total ? `R$ ${fmtN(total)}M${b.comite ? ` · ${b.comite}` : ""}` : null}>
        {!total && <SemInfo />}
        {[["aprovados", "aprovado", D.greenBg, D.green], ["ressalvados", "ressalvado", D.amberBg, D.amber], ["reprovados", "reprovado", D.redBg, D.red]].map(([g, label, bg, color]) =>
          (b[g] || []).map((r, i) => (
            <Row key={g + i}>
              <span className="flex-1 break-words" style={{ color: D.text }}>{r[0]}</span>
              <span className="text-xs font-medium" style={{ color: D.sub }}>R$ {fmtN(num(r[1]))}M</span>
              <Badge bg={bg} color={color}>{label}</Badge>
            </Row>
          ))
        )}
        <Comment b={b} />
      </Card>
    );
  };

  const renderText = (b) => {
    const vazio = !(b.text || "").trim();
    if (vazio && !(b.comment || "").trim() && !showEmpty) return null;
    return (
      <Card key={b.id} title={b.title}>
        {vazio ? <SemInfo /> : <p className="text-sm whitespace-pre-wrap leading-6" style={{ color: D.sub }}>{b.text}</p>}
        <Comment b={b} />
      </Card>
    );
  };

  const renderReunioes = (b) => {
    // os números já estão nos KPIs do topo; o card aparece se houver comentário
    if (!(b.comment || "").trim() && !showEmpty) return null;
    const sub = b.type === "leads"
      ? `${b.inbound || 0} inbound · ${b.remarketing || 0} remarketing`
      : `${b.agendadas || 0} agendadas · ${b.realizadas || 0} realizadas`;
    return (
      <Card key={b.id} title={b.title} sub={sub}>
        <Comment b={b} />
      </Card>
    );
  };

  const renderConsolidado = (b) => {
    const items = consolidadoItems(b).map(([k, label, money]) =>
      [label.replace(/^\S+\s/, ""), consolidadoEff(b, k), money]);
    if (!items.some(([, val]) => val) && !showEmpty) return null;
    return (
      <Card key={b.id} title={b.title} sub={b.mes || null}>
        <div className="grid grid-cols-2 gap-2">
          {items.map(([label, val, money]) => (
            <div key={label} className="rounded-lg border px-3 py-2" style={{ borderColor: D.line, background: D.bg }}>
              <p className="text-xs" style={{ color: D.mut }}>{label}</p>
              <p className="text-lg font-semibold" style={{ color: D.text }}>{money ? `R$ ${fmtN(val || 0)}M` : (val || 0)}</p>
            </div>
          ))}
        </div>
        <Comment b={b} />
      </Card>
    );
  };

  const renderFup = (b) => {
    const vazio = !(b.text || "").trim();
    if (vazio && !(b.comment || "").trim() && !showEmpty) return null;
    return (
      <Card key={b.id} title={b.title} sub={b.date || null}>
        {vazio ? <SemInfo /> : <p className="text-sm whitespace-pre-wrap leading-6" style={{ color: D.sub }}>{b.text}</p>}
        <Comment b={b} />
      </Card>
    );
  };

  return (
    <div className="rounded-2xl p-4" style={{ background: D.bg }}>
      {header && (
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-base font-semibold" style={{ color: D.text }}>{header.title}</p>
            <p className="text-xs mt-0.5" style={{ color: D.mut }}>home › <span style={{ color: D.green }}>{header.crumb}</span></p>
          </div>
          <Badge bg={D.greenBg} color={D.green}>{header.badge || "Semana atual"}</Badge>
        </div>
      )}

      {kpis.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-xl border px-3.5 py-3" style={{ borderColor: D.line, background: D.card }}>
              <p className="text-xs" style={{ color: D.mut }}>{k.label}</p>
              <p className="text-2xl font-semibold" style={{ color: D.text }}>
                {k.money ? `R$ ${fmtN(k.cur)}M` : k.cur}
                <Delta cur={k.cur} prev={k.prev} money={k.money} />
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="md:columns-2 gap-3">
        {B.map((b) => {
          if (b.type === "list") return renderList(b);
          if (b.type === "table") return renderTable(b);
          if (b.type === "check") return renderCheck(b);
          if (b.type === "metric") return renderMetric(b);
          if (b.type === "sql") return renderSql(b);
          if (b.type === "text") return renderText(b);
          if (b.type === "fup") return renderFup(b);
          if (b.type === "consolidado") return renderConsolidado(b);
          if (b.type === "reunioes" || b.type === "leads") return renderReunioes(b);
          return null;
        })}
      </div>
    </div>
  );
}
