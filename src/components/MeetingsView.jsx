import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { C } from "../lib/util.js";

export default function MeetingsView({ agenda, loading, err, onRefresh }) {
  const [range, setRange] = useState("day");
  const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
  const days = range === "day" ? 1 : range === "week" ? 7 : 31;
  const limit = new Date(startToday); limit.setDate(limit.getDate() + days);

  const evs = (agenda.events || []).filter((e) => {
    const d = new Date(e.inicio);
    return d >= startToday && d < limit;
  }).sort((a, b) => a.inicio.localeCompare(b.inicio));

  const byDay = {};
  evs.forEach((e) => { const k = e.inicio.slice(0, 10); (byDay[k] = byDay[k] || []).push(e); });

  const fmtDay = (k) => {
    const [y, m, d] = k.split("-").map(Number);
    const wd = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"][new Date(y, m - 1, d).getDay()];
    return `${wd} · ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
  };
  const hm = (s) => (s || "").slice(11, 16);
  const ago = agenda.fetchedAt ? Math.round((Date.now() - agenda.fetchedAt) / 60000) : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-5">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <h1 className="text-xl font-semibold flex-1" style={{ color: "#1F2937", fontFamily: "Georgia, serif" }}>Reuniões</h1>
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: C.line }}>
          {[["day", "Hoje"], ["week", "Semana"], ["month", "Mês"]].map(([v, label]) => (
            <button key={v} onClick={() => setRange(v)} className="px-3 py-1.5 text-xs font-medium"
              style={range === v ? { background: C.stamp, color: "#fff" } : { background: "#fff", color: "#4B5563" }}>
              {label}
            </button>
          ))}
        </div>
        <button onClick={onRefresh} className="p-1.5 rounded-lg" style={{ background: "#E2E5E9", color: "#374151" }} title="Atualizar agenda">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      <p className="text-xs mb-4" style={{ color: "#9CA3AF" }}>
        Agenda do seu Outlook (só você vê a sua){ago !== null ? ` · atualizada há ${ago} min` : ""}
      </p>

      {err && <p className="text-sm mb-3" style={{ color: C.danger }}>{err}</p>}
      {loading && !evs.length && <p className="text-sm flex items-center gap-2" style={{ color: "#6B7280" }}><Loader2 size={14} className="animate-spin" /> Buscando sua agenda…</p>}
      {!loading && !err && evs.length === 0 && <p className="text-sm" style={{ color: "#6B7280" }}>Nenhuma reunião neste período.</p>}

      {Object.keys(byDay).map((k) => (
        <div key={k} className="mb-4">
          <p className="text-xs font-bold uppercase tracking-widest mb-1.5 pb-1 border-b" style={{ color: C.stamp, borderColor: C.line }}>{fmtDay(k)}</p>
          <div className="flex flex-col gap-1.5">
            {byDay[k].map((e, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: C.line, background: "#fff" }}>
                <span className="text-xs font-semibold shrink-0 w-20" style={{ color: C.date }}>{hm(e.inicio)}–{hm(e.fim)}</span>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium" style={{ color: "#1F2937" }}>{e.titulo}</p>
                  <p className="text-xs truncate" style={{ color: "#9CA3AF" }}>
                    {e.souOrganizador ? "você organiza" : e.organizador || ""}
                    {e.local ? ` · ${/^http/.test(e.local) || /teams|meet/i.test(e.local) ? "online" : e.local}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
