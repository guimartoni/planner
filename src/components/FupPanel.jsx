/* Painel visual do FUP (gerado dos blocos, com deltas da semana anterior) */
export default function FupPanel({ blocks, prevBlocks, header }) {
  const num = (s) => { const m = String(s || "").replace(",", ".").match(/[\d.]+/); return m ? parseFloat(m[0]) : 0; };
  const fmtN = (n) => String(Math.round(n * 10) / 10).replace(".", ",");
  const norm = (s) => (s || "").trim().toLowerCase();
  const find = (re, type) => (blocks || []).find((b) => (type ? b.type === type : true) && re.test(b.title));
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

  const realiz = find(/REALIZADAS NA SEMANA/i) || find(/VISITAS REALIZADAS/i);
  const agend = find(/AGENDADAS/i, "table");
  const aAgendar = find(/A AGENDAR/i, "table");
  const pipeR = find(/PIPE REALIZADAS/i, "table");
  const pipeA = find(/A REALIZAR/i, "table");
  const sql = (blocks || []).find((b) => b.type === "sql");
  const apres = find(/A APRESENTAR/i, "table");
  const tema = (blocks || []).find((b) => b.type === "text");

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

  const kpis = [];
  (blocks || []).filter((b) => b.type === "metric").forEach((mb) => {
    const p = findPrev(mb);
    kpis.push({ label: mb.title.replace(/^[^0-9A-Za-zÀ-ÿ]+\s*/, ""), cur: num(mb.value), prev: p ? num(p.value) : null });
  });
  if (realiz) kpis.push({ label: "Visitas realizadas", cur: names(realiz).length, prev: findPrev(realiz) ? names(findPrev(realiz)).length : null });
  if (agend) kpis.push({ label: "Visitas agendadas", cur: names(agend).length, prev: findPrev(agend) ? names(findPrev(agend)).length : null });
  if (pipeR) kpis.push({ label: "Ops mapeadas", cur: sumCol(pipeR, /opera/i), prev: findPrev(pipeR) ? sumCol(findPrev(pipeR), /opera/i) : null });
  const callsPar = find(/CALLS.*PARCEIR/i, "table");
  const callsCli = find(/CALLS.*CLIENTE/i, "table");
  const novosPar = find(/NOVOS PARCEIROS/i);
  if (callsPar) kpis.push({ label: "Calls c/ parceiros", cur: (callsPar.rows || []).length, prev: findPrev(callsPar) ? (findPrev(callsPar).rows || []).length : null });
  if (callsCli) kpis.push({ label: "Calls c/ clientes", cur: (callsCli.rows || []).length, prev: findPrev(callsCli) ? (findPrev(callsCli).rows || []).length : null });
  if (novosPar) kpis.push({ label: "Novos parceiros", cur: names(novosPar).length, prev: findPrev(novosPar) ? names(findPrev(novosPar)).length : null });
  if (apres) kpis.push({ label: "SQL a apresentar", cur: sumCol(apres, /volume|\(m\)/i), prev: findPrev(apres) ? sumCol(findPrev(apres), /volume|\(m\)/i) : null, money: true });

  const Card = ({ title, sub, children }) => (
    <div className="rounded-xl border p-4" style={{ borderColor: D.line, background: D.card }}>
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
  const isNew = (b, name) => { const p = findPrev(b); return p ? !names(p).map(norm).includes(norm(name)) : false; };
  const repeats = (b, name) => { const p = findPrev(b); return p ? names(p).map(norm).includes(norm(name)) : false; };
  const dSort = (rows, di) => [...rows].sort((a, b) => {
    const k = (r) => { const m = String(r[di] || "").match(/(\d{1,2})\/(\d{1,2})/); return m ? `${m[2].padStart(2, "0")}${m[1].padStart(2, "0")}` : "9999"; };
    return k(a).localeCompare(k(b));
  });

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {realiz && (
          <Card title="✅ Visitas realizadas na semana">
            {names(realiz).map((n, i) => (
              <Row key={i} last={i === names(realiz).length - 1}>
                <span className="flex-1" style={{ color: D.text }}>{n}</span>
                {isNew(realiz, n) && <Badge bg={D.greenBg} color={D.green}>nova</Badge>}
              </Row>
            ))}
            {realiz.comment && <p className="text-xs mt-2" style={{ color: D.mut }}>💬 {realiz.comment}</p>}
          </Card>
        )}
        {agend && (
          <Card title="📅 Visitas agendadas">
            {agend.comment && <p className="text-xs -mt-1 mb-2" style={{ color: D.amber }}>{agend.comment}</p>}
            {dSort(agend.rows || [], 1).map((r, i, arr) => (
              <Row key={i} last={i === arr.length - 1}>
                <span className="flex-1 truncate" style={{ color: D.text }}>{r[0]}</span>
                {isNew(agend, r[0]) && <Badge bg={D.greenBg} color={D.green}>nova</Badge>}
                <span className="text-xs" style={{ color: D.sub }}>{[r[1], r[2]].filter(Boolean).join(" · ")}</span>
              </Row>
            ))}
          </Card>
        )}
        {pipeR && (
          <Card title="📞 Calls de pipe realizadas" sub={`${fmtN(sumCol(pipeR, /opera/i))} ops mapeadas`}>
            {[...(pipeR.rows || [])].sort((a, b) => num(b[1]) - num(a[1])).map((r, i, arr) => (
              <Row key={i} last={i === arr.length - 1}>
                <span className="flex-1 truncate" style={{ color: D.text }}>{r[0]}</span>
                {r[2] && <Badge bg={D.amberBg} color={D.amber}>{r[2]}</Badge>}
                <span className="text-xs font-medium" style={{ color: D.sub }}>{num(r[1])} op{num(r[1]) > 1 ? "s" : ""}</span>
              </Row>
            ))}
          </Card>
        )}
        <div className="flex flex-col gap-3">
          {pipeA && (
            <Card title="📞 Calls de pipe a realizar">
              {[...(pipeA.rows || [])].sort((a, b) => (/forte/i.test(b[1] || "") ? 1 : 0) - (/forte/i.test(a[1] || "") ? 1 : 0)).map((r, i, arr) => (
                <Row key={i} last={i === arr.length - 1}>
                  <span className="flex-1 truncate" style={{ color: D.text }}>{r[0]}</span>
                  {r[1] && <Badge bg={/forte/i.test(r[1]) ? D.blueBg : "transparent"} color={/forte/i.test(r[1]) ? D.blue : D.mut}>{r[1]}</Badge>}
                </Row>
              ))}
            </Card>
          )}
          {aAgendar && (
            <Card title="📍 Visitas a agendar">
              {(aAgendar.rows || []).map((r, i, arr) => (
                <Row key={i} last={i === arr.length - 1}>
                  <span className="flex-1 truncate" style={{ color: D.text }}>{r[0]}</span>
                  {repeats(aAgendar, r[0]) && <Badge bg={D.amberBg} color={D.amber}>repete</Badge>}
                  <span className="text-xs" style={{ color: D.mut }}>{[r[1], r[2]].filter(Boolean).join(" · ")}</span>
                </Row>
              ))}
            </Card>
          )}
        </div>
        {sql && (
          <Card title="⚖️ SQL — último comitê" sub={`R$ ${fmtN(["aprovados", "ressalvados", "reprovados"].reduce((a, g) => a + (sql[g] || []).reduce((x, r) => x + num(r[1]), 0), 0))}M${sql.comite ? ` · ${sql.comite}` : ""}`}>
            {[["aprovados", "aprovado", D.greenBg, D.green], ["ressalvados", "ressalvado", D.amberBg, D.amber], ["reprovados", "reprovado", D.redBg, D.red]].map(([g, label, bg, color]) =>
              (sql[g] || []).map((r, i) => (
                <Row key={g + i}>
                  <span className="flex-1 truncate" style={{ color: D.text }}>{r[0]}</span>
                  <span className="text-xs font-medium" style={{ color: D.sub }}>R$ {fmtN(num(r[1]))}M</span>
                  <Badge bg={bg} color={color}>{label}</Badge>
                </Row>
              ))
            )}
            {sql.comment && <p className="text-xs mt-2" style={{ color: D.mut }}>💬 {sql.comment}</p>}
          </Card>
        )}
        <div className="flex flex-col gap-3">
          {apres && (
            <Card title="🎯 SQL — a apresentar" sub={`R$ ${fmtN(sumCol(apres, /volume|\(m\)/i))}M`}>
              {[...(apres.rows || [])].sort((a, b) => num(b[1]) - num(a[1])).map((r, i, arr) => (
                <Row key={i} last={i === arr.length - 1}>
                  <span className="flex-1 truncate" style={{ color: D.text }}>{r[0]}</span>
                  <span className="text-xs font-medium" style={{ color: D.text }}>R$ {r[1]}M</span>
                </Row>
              ))}
            </Card>
          )}
          {tema && (tema.text || tema.comment) && (
            <Card title="📌 Pendências / tema geral">
              <p className="text-sm whitespace-pre-wrap leading-6" style={{ color: D.sub }}>{tema.text}</p>
              {tema.comment && <p className="text-xs mt-2" style={{ color: D.mut }}>💬 {tema.comment}</p>}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
