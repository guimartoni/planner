import { useRef, useState } from "react";
import { Check, Copy, FileDown, Loader2, Pencil, Send, Sparkles } from "lucide-react";
import { C } from "../lib/util.js";
import { blocksToText } from "../lib/data.js";
import { agruparPorResponsavel, checklistWhats } from "../lib/checklist.js";
import { ataToPdf } from "../pdf.js";
import Avatar from "./Avatar.jsx";
import FupPanel from "./FupPanel.jsx";
import PageImages from "./PageImages.jsx";
import PageFiles from "./PageFiles.jsx";

/* Checklist do que precisa ser feito na semana — a IA lê a ata inteira e
   monta; o texto do WhatsApp sai pronto para copiar. */
function ChecklistSemana({ body, s0, checklist }) {
  const [copiado, setCopiado] = useState(false);
  const chk = body.checklist;
  const itens = (chk && chk.itens) || [];
  const { busy, fila, erro, onGerar } = checklist || {};
  const texto = checklistWhats(chk, { titulo: s0.titulo, data: s0.data });

  const copiar = () => {
    const ta = document.createElement("textarea");
    ta.value = texto;
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); setCopiado(true); setTimeout(() => setCopiado(false), 1500); } catch (e) {}
    document.body.removeChild(ta);
  };

  if (!onGerar) return null;
  return (
    <div className="rounded-xl border shadow-sm p-4 mt-3" style={{ borderColor: C.line, background: C.paper }}>
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <p className="text-xs font-bold uppercase tracking-widest flex-1" style={{ color: C.stamp }}>
          ✅ Checklist da semana
        </p>
        {itens.length > 0 && (
          <>
            <button onClick={copiar} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: "#E2E5E9", color: "#374151" }}>
              {copiado ? <Check size={13} /> : <Copy size={13} />} {copiado ? "Copiado!" : "Copiar p/ WhatsApp"}
            </button>
            <a href={"https://wa.me/?text=" + encodeURIComponent(texto)} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white no-underline"
              style={{ background: "#1FAF57" }}>
              <Send size={13} /> WhatsApp
            </a>
          </>
        )}
        <button onClick={onGerar} disabled={busy || fila}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
          style={{ background: C.ink, opacity: busy || fila ? 0.6 : 1 }}>
          {busy || fila ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          {busy ? "Gerando…" : fila ? "Na fila da IA…" : itens.length ? "Gerar de novo" : "Gerar com IA"}
        </button>
      </div>

      {fila && (
        <p className="text-xs mb-2" style={{ color: C.date }}>
          O pedido foi para a fila da IA — o computador com o Planner Fila IA responde em cerca de um minuto.
        </p>
      )}
      {erro && <p className="text-xs mb-2" style={{ color: C.danger }}>{erro}</p>}

      {itens.length === 0 ? (
        <p className="text-xs" style={{ color: "#9CA3AF", fontFamily: "system-ui, sans-serif" }}>
          A IA lê esta ata inteira (incluindo a transcrição, se houver) e monta a lista do que precisa ser feito na semana, já separada por responsável e pronta para mandar no WhatsApp.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5" style={{ fontFamily: "system-ui, sans-serif" }}>
          {agruparPorResponsavel(itens).map((g) => (
            <div key={g.nome}>
              <p className="text-xs font-semibold mb-1" style={{ color: C.mention }}>{g.nome}</p>
              {g.itens.map((i, k) => (
                <div key={k} className="flex items-start gap-2 py-1 text-sm" style={{ color: "#374151" }}>
                  <span className="mt-0.5">{i.prioridade === "alta" ? "🔴" : "▫️"}</span>
                  <span className="flex-1">{i.tarefa}</span>
                  {i.prazo && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                      style={{ background: C.dateSoft, color: C.date }}>{i.prazo}</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const Sec = ({ label, children }) => (
  <div className="mb-4">
    <p className="text-xs font-bold uppercase tracking-widest mb-1.5 pb-1 border-b" style={{ color: C.stamp, borderColor: C.line }}>{label}</p>
    {children}
  </div>
);

export default function AtaDocument({ body, tasks, meta, prevBlocks, onReopen, onOpenFile, checklist }) {
  const [copied, setCopied] = useState(null); // 'plain' | 'whats'
  const [pdfBusy, setPdfBusy] = useState(false);
  const printRef = useRef(null);

  const baixarPdf = async (titulo, data, larguraPapel) => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try { await ataToPdf({ element: printRef.current, titulo, data, larguraPapel }); } catch (e) {}
    setPdfBusy(false);
  };

  /* ---------- ata de FUP: painel escuro + ações ---------- */
  if (body.blocks) {
    const s0 = body.structured || {};
    const openT = tasks.filter((t) => !t.done);
    const copyTxt = () => {
      const ta = document.createElement("textarea");
      ta.value = `${s0.titulo || "FUP Semanal"} — ${s0.data || ""}\n\n${blocksToText(body.blocks)}\n\nAÇÕES\n${openT.map((a) => `- ${a.text} — ${a.userName || "sem responsável"}${a.date ? " — " + a.date : ""}`).join("\n")}`;
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta);
    };
    const whatsTxt = () => {
      let t = `*📋 ${s0.titulo || "FUP Semanal"}* — _${s0.data || ""}_\n`;
      if (openT.length) t += `\n*✅ Ações*\n${openT.map((a) => `• ${a.text}${a.userName ? " — @" + a.userName : ""}${a.date ? " (" + a.date + ")" : ""}`).join("\n")}\n`;
      t += `\n_Planner - Gui - Finamob_`;
      return t;
    };
    return (
      <div className="max-w-4xl mx-auto px-3 py-4">
        <div className="flex items-center justify-end gap-2 mb-2">
          <button onClick={() => baixarPdf(s0.titulo, s0.data)} disabled={pdfBusy}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: C.ink, opacity: pdfBusy ? 0.7 : 1 }}>
            {pdfBusy ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />} PDF
          </button>
          <button onClick={copyTxt} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "#E2E5E9", color: "#374151" }}>Copiar</button>
          <a href={"https://wa.me/?text=" + encodeURIComponent(whatsTxt())} target="_blank" rel="noreferrer"
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white no-underline" style={{ background: "#1FAF57" }}>WhatsApp</a>
          <button onClick={onReopen} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "#E2E5E9", color: "#374151" }}>✏️ Reabrir</button>
        </div>
        <div ref={printRef}>
        <FupPanel blocks={body.blocks} prevBlocks={prevBlocks} showEmpty
          header={{ title: s0.titulo || "FUP semanal", crumb: `FUP ${s0.data || ""}`, badge: "Semana atual" }} />
        {((body.images || []).length > 0 || (body.files || []).length > 0) && (
          <div className="rounded-xl border p-4 mt-3" style={{ borderColor: C.line, background: "#fff" }}>
            <PageImages images={body.images} readOnly />
            <PageFiles files={body.files} readOnly onOpen={onOpenFile} />
          </div>
        )}
        {openT.length > 0 && (
          <div className="rounded-2xl p-4 mt-3" style={{ background: "#14171C" }}>
            <div className="rounded-xl border p-4" style={{ borderColor: "#2B313A", background: "#1D2127" }}>
              <p className="text-sm font-semibold mb-2" style={{ color: "#E6E8EB" }}>✅ Ações da reunião</p>
              {openT.map((a) => (
                <div key={a.id} className="flex items-center gap-2 py-1.5 text-sm" style={{ borderBottom: "0.5px solid #2B313A", color: "#B7BDC6" }}>
                  <span className="flex-1">{a.important ? "⭐ " : ""}{a.text}</span>
                  {a.userName && <span className="text-xs" style={{ color: "#6FA8E8" }}>@{a.userName}</span>}
                  {a.date && <span className="text-xs" style={{ color: "#E8B45A" }}>{a.date}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
        <ChecklistSemana body={body} s0={s0} checklist={checklist} />
      </div>
    );
  }

  /* ---------- ata clássica (páginas livres) ---------- */
  const s = body.structured;

  const plain = () =>
    `ATA DE REUNIÃO — ${s.titulo}\nData: ${s.data}\n\nPARTICIPANTES\n${(s.participantes || []).map((p) => "- " + p).join("\n")}\n\nRESUMO\n${s.resumo}\n\nPAUTA\n${(s.pauta || []).map((p) => "- " + p).join("\n")}\n\nDECISÕES\n${(s.decisoes || []).map((p) => "- " + p).join("\n")}\n\nAÇÕES\n${tasks.map((a) => `- ${a.text} — ${a.userName || "sem responsável"}${a.date ? " — prazo " + a.date : ""}`).join("\n")}`;

  const whats = () => {
    let t = `*📋 ATA DE REUNIÃO*\n*${s.titulo}* — _${s.data}_\n\n`;
    if ((s.participantes || []).length) t += `*👥 Participantes:* ${s.participantes.join(", ")}\n\n`;
    if (s.resumo) t += `*📝 Resumo*\n${s.resumo}\n\n`;
    if ((s.decisoes || []).length) t += `*✅ Decisões*\n${s.decisoes.map((d) => "• " + d).join("\n")}\n\n`;
    if (tasks.length) {
      t += `*📌 Ações*\n${tasks.map((a) => `• ${a.text} — *@${a.userName || "a definir"}*${a.date ? ` (🗓 ${a.date})` : ""}`).join("\n")}`;
    }
    return t.trim();
  };

  const copy = (kind) => {
    const ta = document.createElement("textarea");
    ta.value = kind === "whats" ? whats() : plain();
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); setCopied(kind); setTimeout(() => setCopied(null), 1500); } catch (e) {}
    document.body.removeChild(ta);
  };

  const userOf = (t) => meta.users.find((u) => u.id === t.userId) || null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-5">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button onClick={onReopen} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm" style={{ background: "#E2E5E9", color: "#374151" }}>
          <Pencil size={13} /> Reabrir e editar
        </button>
        <div className="flex-1" />
        <button onClick={() => baixarPdf(s.titulo, s.data, 760)} disabled={pdfBusy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: C.ink, opacity: pdfBusy ? 0.7 : 1 }}>
          {pdfBusy ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} PDF
        </button>
        <button onClick={() => copy("plain")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white" style={{ background: C.inkSoft }}>
          {copied === "plain" ? <Check size={14} /> : <Copy size={14} />} {copied === "plain" ? "Copiada!" : "Copiar ata"}
        </button>
        <button onClick={() => copy("whats")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ background: "#E2E5E9", color: "#374151" }}>
          {copied === "whats" ? <Check size={14} /> : <Copy size={14} />} {copied === "whats" ? "Copiada!" : "Copiar p/ WhatsApp"}
        </button>
        <button onClick={() => window.open("https://wa.me/?text=" + encodeURIComponent(whats()), "_blank")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: "#1FAF57" }}>
          <Send size={14} /> WhatsApp
        </button>
      </div>

      <div ref={printRef} className="relative rounded-xl border shadow-sm p-6 md:p-8" style={{ background: C.paper, borderColor: C.line, fontFamily: "Georgia, serif" }}>
        <div className="absolute top-5 right-5 px-3 py-1 border-2 rounded text-xs font-bold tracking-widest uppercase rotate-6 select-none"
          style={{ borderColor: C.stamp, color: C.stamp, background: "rgba(30,107,79,.05)" }}>
          Ata concluída
        </div>

        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#6B7280" }}>Ata de reunião · {s.data}</p>
        <h1 className="text-2xl font-bold mb-4 pr-24" style={{ color: "#1F2937" }}>{s.titulo}</h1>

        <Sec label="Participantes">
          <p className="text-sm leading-6" style={{ color: "#374151" }}>{(s.participantes || []).join(" · ")}</p>
        </Sec>
        <Sec label="Resumo">
          <p className="text-sm leading-7" style={{ color: "#374151" }}>{s.resumo}</p>
        </Sec>
        {(s.pauta || []).length > 0 && (
          <Sec label="Pauta">
            {s.pauta.map((p, i) => <p key={i} className="text-sm leading-7" style={{ color: "#374151" }}>• {p}</p>)}
          </Sec>
        )}
        {(s.decisoes || []).length > 0 && (
          <Sec label="Decisões">
            {s.decisoes.map((p, i) => <p key={i} className="text-sm leading-7" style={{ color: "#374151" }}>• {p}</p>)}
          </Sec>
        )}
        {(body.images || []).length > 0 && (
          <Sec label="Imagens">
            <PageImages images={body.images} readOnly />
          </Sec>
        )}
        {(body.files || []).length > 0 && (
          <Sec label="Arquivos anexados">
            <PageFiles files={body.files} readOnly onOpen={onOpenFile} />
          </Sec>
        )}
        {tasks.length > 0 && (
          <Sec label="Ações e responsáveis">
            <div className="flex flex-col gap-1.5" style={{ fontFamily: "system-ui, sans-serif" }}>
              {tasks.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: C.line, background: "#fff" }}>
                  {userOf(t) ? <Avatar user={userOf(t)} /> : <span className="text-xs px-1.5" style={{ color: "#9CA3AF" }}>—</span>}
                  <span className="flex-1" style={{ color: "#374151" }}>{t.text}</span>
                  <span className="text-xs hidden sm:inline" style={{ color: C.mention }}>{t.userName || ""}</span>
                  {t.date && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: C.dateSoft, color: C.date }}>{t.date}</span>}
                </div>
              ))}
            </div>
          </Sec>
        )}
      </div>
      <ChecklistSemana body={body} s0={s} checklist={checklist} />
    </div>
  );
}
