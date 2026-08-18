import { useRef, useState } from "react";
import { ArrowLeft, Check, Copy, FileDown, Loader2, Send } from "lucide-react";
import { C, todayBR } from "../lib/util.js";
import { faixaSemana, rotuloSemana, semanaAtual, statusDe } from "../lib/semana.js";
import { ESTILO, PRIORIDADE, ordenar, porSemana, prioridadeDe, todasAtividades } from "../lib/mia.js";
import { ataToPdf } from "../pdf.js";

/* Ata da MIA: uma foto do painel para mandar por WhatsApp, copiar ou baixar em
   PDF. Sai do estado atual — seções, cronograma da semana e comentários. */

const Sec = ({ label, children }) => (
  <div className="mb-4">
    <p className="text-xs font-bold uppercase tracking-widest mb-1.5 pb-1 border-b" style={{ color: C.stamp, borderColor: C.line }}>{label}</p>
    {children}
  </div>
);

const soRotulo = (r) => r.replace(/^\S+\s/, ""); // tira o emoji

export default function MiaAta({ mia, onVoltar }) {
  const [copiado, setCopiado] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const printRef = useRef(null);

  const todas = todasAtividades(mia);
  const abertas = todas.filter((a) => !a.concluida);
  const emAtraso = abertas.filter((a) => statusDe(a) === "atraso");
  const daSemana = abertas.filter((a) => a.semana === semanaAtual());
  const semanas = porSemana(mia);
  const titulo = "MIA — atividades programadas";

  const linhaTexto = (a) =>
    `- ${a.atividade} — ${soRotulo(PRIORIDADE[prioridadeDe(a)].rotulo)} · ${a.semana ? rotuloSemana(a.semana) : "sem semana"} · ${soRotulo(ESTILO[statusDe(a)].rotulo)}`;

  const plain = () => {
    let t = `${titulo.toUpperCase()}\nData: ${todayBR()}\n\n`;
    t += `RESUMO\n- ${abertas.length} em aberto · ${emAtraso.length} em atraso · ${daSemana.length} nesta semana (${rotuloSemana(semanaAtual())})\n\n`;
    mia.secoes.forEach((s) => {
      if (!s.atividades.length) return;
      t += `${(s.nome || "SEÇÃO").toUpperCase()}\n${ordenar(s.atividades).map(linhaTexto).join("\n")}\n\n`;
    });
    if ((mia.comentarios || "").trim()) t += `COMENTÁRIOS GERAIS\n${mia.comentarios.trim()}\n\n`;
    t += `CRONOGRAMA SEMANAL\n`;
    semanas.forEach((g) => {
      t += `${g.semana ? `${rotuloSemana(g.semana)} (${faixaSemana(g.semana)})` : "Sem semana definida"}\n`;
      t += `${ordenar(g.itens).map((a) => `  - [${a.secao}] ${a.atividade} — ${soRotulo(ESTILO[statusDe(a)].rotulo)}`).join("\n")}\n`;
    });
    return t.trim();
  };

  const whats = () => {
    let t = `*🤖 ${titulo}* — _${todayBR()}_\n`;
    t += `\n${abertas.length} em aberto · ${emAtraso.length} em atraso · ${daSemana.length} na ${rotuloSemana(semanaAtual())}\n`;
    semanas.forEach((g) => {
      t += `\n*📅 ${g.semana ? rotuloSemana(g.semana) : "Sem semana definida"}*${g.semana ? ` _(${faixaSemana(g.semana)})_` : ""}\n`;
      t += ordenar(g.itens).map((a) => {
        const p = prioridadeDe(a) === "alta" ? "🔴 " : "";
        const st = statusDe(a) === "concluido" ? " ✅" : statusDe(a) === "atraso" ? " ⚠️" : "";
        return `${p}• ${a.atividade} _(${a.secao})_${st}`;
      }).join("\n") + "\n";
    });
    if ((mia.comentarios || "").trim()) t += `\n*💬 Comentários gerais*\n${mia.comentarios.trim()}\n`;
    t += `\n_Planner - Gui - Finamob_`;
    return t;
  };

  const copiar = (tipo) => {
    const ta = document.createElement("textarea");
    ta.value = tipo === "whats" ? whats() : plain();
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); setCopiado(tipo); setTimeout(() => setCopiado(null), 1500); } catch (e) {}
    document.body.removeChild(ta);
  };

  const baixarPdf = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try { await ataToPdf({ element: printRef.current, titulo, data: todayBR(), larguraPapel: 760 }); } catch (e) {}
    setPdfBusy(false);
  };

  const etiqueta = (fundo, cor, texto) => (
    <span className="text-xs px-2 py-0.5 rounded-full font-semibold shrink-0" style={{ background: fundo, color: cor }}>{texto}</span>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-5">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button onClick={onVoltar} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
          style={{ background: "#E2E5E9", color: "#374151" }}>
          <ArrowLeft size={13} /> Voltar ao painel
        </button>
        <div className="flex-1" />
        <button onClick={baixarPdf} disabled={pdfBusy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white"
          style={{ background: C.ink, opacity: pdfBusy ? 0.7 : 1 }}>
          {pdfBusy ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} PDF
        </button>
        <button onClick={() => copiar("plain")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white" style={{ background: C.inkSoft }}>
          {copiado === "plain" ? <Check size={14} /> : <Copy size={14} />} {copiado === "plain" ? "Copiada!" : "Copiar ata"}
        </button>
        <button onClick={() => copiar("whats")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ background: "#E2E5E9", color: "#374151" }}>
          {copiado === "whats" ? <Check size={14} /> : <Copy size={14} />} {copiado === "whats" ? "Copiada!" : "Copiar p/ WhatsApp"}
        </button>
        <a href={"https://wa.me/?text=" + encodeURIComponent(whats())} target="_blank" rel="noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white no-underline" style={{ background: "#1FAF57" }}>
          <Send size={14} /> WhatsApp
        </a>
      </div>

      <div ref={printRef} className="rounded-xl border shadow-sm p-6 md:p-8"
        style={{ background: C.paper, borderColor: C.line, fontFamily: "Georgia, serif" }}>
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#6B7280" }}>Ata da MIA · {todayBR()}</p>
        <h1 className="text-2xl font-bold mb-1" style={{ color: "#1F2937" }}>{titulo}</h1>
        <p className="text-sm mb-4" style={{ color: "#6B7280" }}>
          {abertas.length} em aberto · {emAtraso.length} em atraso · {daSemana.length} nesta semana ({rotuloSemana(semanaAtual())})
        </p>

        {mia.secoes.map((s) => (
          s.atividades.length > 0 && (
            <Sec key={s.id} label={s.nome || "Seção"}>
              <div className="flex flex-col gap-1.5" style={{ fontFamily: "system-ui, sans-serif" }}>
                {ordenar(s.atividades).map((a) => {
                  const e = ESTILO[statusDe(a)];
                  const p = PRIORIDADE[prioridadeDe(a)];
                  return (
                    <div key={a.id} className="flex items-start gap-2 rounded-lg border px-3 py-2 text-sm"
                      style={{ borderColor: C.line, background: "#fff" }}>
                      <span className="shrink-0 mt-0.5">{p.rotulo.split(" ")[0]}</span>
                      <span className="flex-1" style={{ color: "#374151", opacity: a.concluida ? 0.6 : 1 }}>{a.atividade}</span>
                      {a.semana && etiqueta(C.dateSoft, C.date, rotuloSemana(a.semana))}
                      {etiqueta(e.background, e.color, e.rotulo)}
                    </div>
                  );
                })}
              </div>
            </Sec>
          )
        ))}

        {(mia.comentarios || "").trim() && (
          <Sec label="Comentários gerais">
            <p className="text-sm leading-7 whitespace-pre-wrap" style={{ color: "#374151" }}>{mia.comentarios.trim()}</p>
          </Sec>
        )}

        <Sec label="Cronograma semanal">
          <div style={{ fontFamily: "system-ui, sans-serif" }}>
            {semanas.map((g) => (
              <div key={g.semana || "sem"} className="mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={g.semana === semanaAtual() ? { background: C.stamp, color: "#fff" } : { background: "#EEF0F2", color: "#4B5563" }}>
                    {g.semana ? rotuloSemana(g.semana) : "sem semana definida"}
                  </span>
                  {g.semana && <span className="text-xs" style={{ color: "#9CA3AF" }}>{faixaSemana(g.semana)}</span>}
                </div>
                {ordenar(g.itens).map((a) => {
                  const e = ESTILO[statusDe(a)];
                  return (
                    <div key={a.id} className="flex items-start gap-2 py-1 pl-2 text-sm" style={{ color: "#374151" }}>
                      <span className="text-xs shrink-0 mt-0.5">{PRIORIDADE[prioridadeDe(a)].rotulo.split(" ")[0]}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded shrink-0 mt-0.5" style={{ background: C.mentionSoft, color: C.mention }}>{a.secao}</span>
                      <span className="flex-1" style={{ opacity: a.concluida ? 0.6 : 1 }}>{a.atividade}</span>
                      {etiqueta(e.background, e.color, e.rotulo)}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </Sec>
      </div>
    </div>
  );
}
