import { useState } from "react";
import { Check, Copy, Loader2, RefreshCw, Send, Sparkles, X } from "lucide-react";
import { C, dateKeyBR, isoToday, todayBR } from "../lib/util.js";
import { TaskItem } from "./TasksView.jsx";

export default function ReportView({ agenda, meta, me, loading, onToggle, onGo, onRefresh, onSendAll, sendList, onMarkSent, onCloseSend, tmbKey, onWeekly, weekly, onCloseWeekly }) {
  const [copied, setCopied] = useState(false);
  const configured = tmbKey ? (meta.users || []).filter((u) => u.phone).length : 0;
  const autoToday = (meta.autoSend || "") === isoToday();
  const tKey = dateKeyBR(todayBR());
  const localIso = isoToday();
  const hm = (s) => (s || "").slice(11, 16);

  const meetings = (agenda.events || []).filter((e) => e.inicio.slice(0, 10) === localIso)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));

  const due = (t) => !t.done && (!t.date || dateKeyBR(t.date) <= tKey);
  const sortDue = (a, b) => (dateKeyBR(a.date) || "99999999").localeCompare(dateKeyBR(b.date) || "99999999");
  const mine = (meta.tasks || []).filter((t) => t.userId === me?.id && due(t)).sort(sortDue);
  const others = (meta.tasks || []).filter((t) => t.userId && t.userId !== me?.id && due(t)).sort(sortDue);
  const othersBy = {};
  others.forEach((t) => { (othersBy[t.userName] = othersBy[t.userName] || []).push(t); });

  const reportText = () => {
    let txt = `*📋 RELATÓRIO DO DIA — ${todayBR()}*\n\n*🗓 Reuniões (${meetings.length})*\n`;
    txt += meetings.length ? meetings.map((e) => `• ${hm(e.inicio)}–${hm(e.fim)} ${e.titulo}`).join("\n") : "• sem reuniões";
    txt += `\n\n*✅ Minhas pendências (${mine.length})*\n`;
    txt += mine.length ? mine.map((t) => `• ${t.important ? "⭐ " : ""}${t.text} ${t.date ? `(${t.date})` : "(sem prazo)"}${t.date && dateKeyBR(t.date) < tKey ? " ⚠️ atrasada" : ""}`).join("\n") : "• em dia";
    txt += `\n\n*👥 Pendências da equipe (${others.length})*\n`;
    if (others.length) {
      Object.keys(othersBy).forEach((name) => {
        txt += `_${name}_\n` + othersBy[name].map((t) => `• ${t.important ? "⭐ " : ""}${t.text} ${t.date ? `(${t.date})` : "(sem prazo)"}${t.date && dateKeyBR(t.date) < tKey ? " ⚠️" : ""}`).join("\n") + "\n";
      });
    } else {
      txt += "• equipe em dia";
    }
    return txt.trim();
  };

  const copy = () => {
    const ta = document.createElement("textarea");
    ta.value = reportText();
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch (e) {}
    document.body.removeChild(ta);
  };

  const openWhats = () => {
    window.open("https://wa.me/?text=" + encodeURIComponent(reportText()), "_blank");
  };

  const SecTitle = ({ children }) => (
    <p className="text-xs font-bold uppercase tracking-widest mb-1.5 pb-1 border-b" style={{ color: C.stamp, borderColor: C.line }}>{children}</p>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-5">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <h1 className="text-xl font-semibold flex-1 flex items-center gap-2" style={{ color: "#1F2937", fontFamily: "Georgia, serif" }}>
          Meu dia · {todayBR()}
          {loading && <Loader2 size={13} className="animate-spin" style={{ color: "#9CA3AF" }} />}
        </h1>
        <button onClick={onRefresh} className="p-1.5 rounded-lg" style={{ background: "#E2E5E9", color: "#374151" }} title="Atualizar">
          <RefreshCw size={14} />
        </button>
        <button onClick={onWeekly} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ background: C.stampSoft, color: C.stamp }}>
          <Sparkles size={14} /> <span className="hidden sm:inline">Resumo semanal</span><span className="sm:hidden">Semana</span>
        </button>
        <button onClick={copy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ background: "#E2E5E9", color: "#374151" }}>
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copiado!" : "Copiar"}
        </button>
        <button onClick={openWhats} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: "#1FAF57" }}>
          <Send size={14} /> WhatsApp
        </button>
      </div>
      <p className="text-xs mb-2" style={{ color: "#9CA3AF" }}>Seu resumo da manhã: agenda, suas pendências e as da equipe.</p>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 mb-4 text-xs" style={{ borderColor: C.line, background: "#fff" }}>
        <Send size={13} color={C.stamp} />
        <span className="flex-1" style={{ color: "#4B5563" }}>
          Envio automático: {configured} pessoa(s) com WhatsApp{configured > 0 ? (autoToday ? " · relatório de hoje já disparado ✓" : " · dispara na 1ª abertura do app após as 7h") : (tmbKey ? " · cadastre os telefones em Equipe" : " · configure a chave TextMeBot em Equipe")}
        </span>
        {configured > 0 && !sendList && (
          <button onClick={() => onSendAll()}
            className="px-2.5 py-1 rounded-lg font-medium text-white shrink-0" style={{ background: C.stamp }}>
            Enviar agora
          </button>
        )}
      </div>

      {sendList && (
        <div className="rounded-xl border p-3 mb-4" style={{ borderColor: C.stamp, background: "#F4FAF7" }}>
          <p className="text-xs font-semibold mb-2" style={{ color: C.stamp }}>
            Disparo do relatório — toque em cada pessoa (abre e envia pelo TextMeBot):
          </p>
          <div className="flex flex-col gap-1.5 mb-2">
            {sendList.map((s) => (
              <a key={s.id} href={s.url} target="_blank" rel="noreferrer"
                onClick={() => onMarkSent(s.id)}
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm no-underline"
                style={{ borderColor: C.line, background: "#fff", color: s.done ? C.stamp : "#374151", opacity: s.done ? 0.7 : 1 }}>
                <Send size={13} color={s.done ? C.stamp : "#6B7280"} />
                <span className="flex-1">{s.name}</span>
                <span className="text-xs font-medium">{s.done ? "enviado ✓" : "tocar para enviar"}</span>
              </a>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: "#6B7280" }}>
              {sendList.filter((s) => s.done).length}/{sendList.length} enviados
            </p>
            <button onClick={onCloseSend} className="text-xs px-2.5 py-1 rounded-lg" style={{ background: "#E2E5E9", color: "#374151" }}>
              Concluir
            </button>
          </div>
        </div>
      )}

      <div className="mb-5">
        <SecTitle>🗓 Reuniões de hoje ({meetings.length})</SecTitle>
        {meetings.length === 0 && <p className="text-sm" style={{ color: "#6B7280" }}>Sem reuniões hoje — dia de trabalho focado.</p>}
        <div className="flex flex-col gap-1.5">
          {meetings.map((e, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: C.line, background: "#fff" }}>
              <span className="text-xs font-semibold shrink-0 w-20" style={{ color: C.date }}>{hm(e.inicio)}–{hm(e.fim)}</span>
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium" style={{ color: "#1F2937" }}>{e.titulo}</p>
                <p className="text-xs truncate" style={{ color: "#9CA3AF" }}>{e.souOrganizador ? "você organiza" : e.organizador || ""}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-5">
        <SecTitle>✅ Minhas pendências de hoje e atrasadas ({mine.length})</SecTitle>
        {mine.length === 0 && <p className="text-sm" style={{ color: "#6B7280" }}>Tudo em dia. 👏</p>}
        <div className="flex flex-col gap-1.5">
          {mine.map((t) => <TaskItem key={t.id} t={t} onToggle={onToggle} onGo={onGo} />)}
        </div>
      </div>

      <div className="mb-5">
        <SecTitle>👥 Pendências da equipe de hoje e atrasadas ({others.length})</SecTitle>
        {others.length === 0 && <p className="text-sm" style={{ color: "#6B7280" }}>Equipe em dia.</p>}
        {Object.keys(othersBy).map((name) => (
          <div key={name} className="mb-3">
            <p className="text-sm font-semibold mb-1.5" style={{ color: "#1F2937" }}>{name}</p>
            <div className="flex flex-col gap-1.5">
              {othersBy[name].map((t) => <TaskItem key={t.id} t={t} onToggle={onToggle} onGo={onGo} />)}
            </div>
          </div>
        ))}
      </div>

      {weekly && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-4" style={{ background: "rgba(20,26,38,.5)" }} onClick={onCloseWeekly}>
          <div className="w-full max-w-lg rounded-2xl p-5 max-h-full overflow-y-auto" style={{ background: "#fff" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold flex items-center gap-2" style={{ color: "#1F2937" }}>
                <Sparkles size={16} color={C.stamp} /> Resumo da semana
              </h2>
              <button onClick={onCloseWeekly}><X size={18} /></button>
            </div>
            {weekly.loading ? (
              <p className="text-sm flex items-center gap-2 py-6" style={{ color: "#6B7280" }}>
                <Loader2 size={14} className="animate-spin" /> Analisando as páginas e tarefas dos últimos 7 dias…
              </p>
            ) : weekly.fila ? (
              <p className="text-sm flex items-center gap-2 py-6" style={{ color: "#6B7280" }}>
                ⏳ Pedido na fila da IA — o resumo aparece aqui em alguns minutos. Pode fechar esta janela e voltar depois.
              </p>
            ) : weekly.text ? (
              <>
                <div className="text-sm whitespace-pre-wrap leading-6 rounded-xl border p-3 mb-3" style={{ borderColor: C.line, color: "#1F2937", background: C.paper }}>
                  {weekly.text}
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => {
                    const ta = document.createElement("textarea"); ta.value = weekly.text;
                    document.body.appendChild(ta); ta.select();
                    try { document.execCommand("copy"); } catch (e) {}
                    document.body.removeChild(ta);
                  }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm" style={{ background: "#E2E5E9", color: "#374151" }}>
                    <Copy size={14} /> Copiar
                  </button>
                  <a href={"https://wa.me/?text=" + encodeURIComponent(weekly.text)} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white no-underline" style={{ background: "#1FAF57" }}>
                    <Send size={14} /> WhatsApp
                  </a>
                </div>
              </>
            ) : (
              <p className="text-sm py-6" style={{ color: "#6B7280" }}>Nenhum resumo ainda — toque em "Resumo semanal" para gerar.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
