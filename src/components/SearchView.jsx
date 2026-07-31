import { useMemo, useState } from "react";
import { Loader2, Search as SearchIcon, Sparkles } from "lucide-react";
import { C } from "../lib/util.js";
import { bodyText } from "../lib/data.js";

export default function SearchView({ meta, loadBody, onGo, acervo, onAsk }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);

  const allNotes = useMemo(() => {
    const list = [];
    (meta.notebooks || []).forEach((nb) => nb.sections.forEach((s) => s.notes.forEach((n) => list.push({ n, nb: nb.name, sec: s.name }))));
    return list;
  }, [meta]);

  const doSearch = () => {
    const query = q.trim().toLowerCase();
    if (!query) return;
    const found = [];
    for (const item of allNotes) {
      const inTitle = (item.n.title || "").toLowerCase().includes(query);
      let snippet = null;
      const b = loadBody(item.n.id);
      const content = bodyText(b);
      const idx = content.toLowerCase().indexOf(query);
      if (idx >= 0) snippet = "…" + content.slice(Math.max(0, idx - 50), idx + 90).replace(/\n/g, " ") + "…";
      if (inTitle || snippet) found.push({ id: item.n.id, title: item.n.title || "Página sem nome", nb: item.nb, sec: item.sec, date: item.n.createdAt, snippet });
    }
    setResults(found);
  };

  const busy = acervo?.busy || acervo?.fila;

  return (
    <div className="max-w-3xl mx-auto px-4 py-5">
      <h1 className="text-xl font-semibold mb-1" style={{ color: "#1F2937", fontFamily: "Georgia, serif" }}>Buscar no acervo</h1>
      <p className="text-xs mb-3" style={{ color: "#9CA3AF" }}>Procure em todas as páginas, ou pergunte à IA sobre o que já foi anotado e decidido. Atalho: Ctrl+K.</p>
      <div className="flex gap-2 mb-2">
        <input value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") doSearch(); }}
          autoFocus
          placeholder={'Ex.: "mailing parcerias" ou "o que decidimos sobre o Rafael?"'}
          className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: C.line, background: "#fff" }} />
      </div>
      <div className="flex gap-2 mb-4">
        <button onClick={doSearch}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: C.inkSoft }}>
          <SearchIcon size={14} /> Buscar
        </button>
        <button onClick={() => { if (q.trim()) { setResults(null); onAsk(q.trim()); } }} disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: C.stamp, opacity: busy ? 0.7 : 1 }}>
          {acervo?.busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {acervo?.fila ? "Na fila da IA…" : "Perguntar à IA"}
        </button>
      </div>

      {acervo?.fila && (
        <p className="text-xs mb-3 rounded-lg px-3 py-2" style={{ background: C.stampSoft, color: C.stamp }}>
          ⏳ Pergunta na fila da IA — a resposta aparece aqui em alguns minutos (pode sair desta tela e voltar).
        </p>
      )}

      {acervo?.resposta && !acervo?.busy && (
        <div className="rounded-xl border p-4 mb-4" style={{ borderColor: C.stamp, background: "#F4FAF7" }}>
          {acervo.resposta.pergunta && (
            <p className="text-xs font-semibold mb-1.5" style={{ color: C.stamp }}>“{acervo.resposta.pergunta}”</p>
          )}
          <p className="text-sm whitespace-pre-wrap leading-6" style={{ color: "#1F2937" }}>{acervo.resposta.texto}</p>
        </div>
      )}

      {results && (
        <>
          <p className="text-xs mb-2" style={{ color: "#9CA3AF" }}>{results.length} página(s) encontrada(s)</p>
          <div className="flex flex-col gap-1.5">
            {results.map((r) => (
              <button key={r.id} onClick={() => onGo(r.id)}
                className="text-left rounded-lg border px-3 py-2.5" style={{ borderColor: C.line, background: "#fff" }}>
                <p className="text-sm font-medium" style={{ color: "#1F2937" }}>{r.title}</p>
                <p className="text-xs" style={{ color: "#9CA3AF" }}>{r.nb} · {r.sec} · {r.date}</p>
                {r.snippet && <p className="text-xs mt-1" style={{ color: "#4B5563" }}>{r.snippet}</p>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
