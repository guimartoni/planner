import { useMemo, useState } from "react";
import { ArrowUpRight, Check, ChevronRight, Copy, Loader2, Pencil, Repeat, Send, Star, Trash2 } from "lucide-react";
import { C, dateKeyBR, todayBR } from "../lib/util.js";
import Avatar from "./Avatar.jsx";

export function TaskItem({ t, onToggle, onGo, users, onEdit, onPlusDays }) {
  const [edit, setEdit] = useState(false);
  const tKey = dateKeyBR(todayBR());
  const late = !t.done && dateKeyBR(t.date) && dateKeyBR(t.date) < tKey;
  return (
    <div className="rounded-lg border"
      style={{
        borderColor: late ? "#E24B4A" : t.important && !t.done ? "#EF9F27" : C.line,
        borderLeftWidth: late ? 4 : 1,
        background: "#fff", opacity: t.done ? 0.55 : 1,
      }}>
      <label className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer">
        <input type="checkbox" checked={!!t.done} onChange={(e) => onToggle(t.id, e.target.checked)} />
        {t.important && <Star size={13} fill="#EF9F27" color="#EF9F27" className="shrink-0" />}
        <div className="flex-1 min-w-0">
          <p style={{ color: "#374151", textDecoration: t.done ? "line-through" : "none" }}>{t.text}</p>
          <p className="text-xs truncate" style={{ color: "#9CA3AF" }}>
            {t.userName ? `@${t.userName} · ` : ""}origem: {t.nbName} · {t.noteTitle}{t.origin === "ia" ? " · ata gerada" : ""}
          </p>
        </div>
        {late && (
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold shrink-0" style={{ background: "#FCEBEB", color: "#A32D2D" }}>
            atrasada
          </span>
        )}
        {t.date && (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
            style={late ? { background: "#FCEBEB", color: "#A32D2D" } : { background: C.dateSoft, color: C.date }}>
            {t.date}
          </span>
        )}
        {onEdit && !t.done && (
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEdit((v) => !v); }}
            className="p-1.5 rounded-lg shrink-0" title="Editar prazo / responsável"
            style={{ background: edit ? C.stamp : "#E2E5E9", color: edit ? "#fff" : "#4B5563" }}>
            <Pencil size={13} />
          </button>
        )}
        {t.noteId ? (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onGo(t.noteId); }}
            className="p-1.5 rounded-lg shrink-0"
            title="Abrir a página onde foi anotada"
            style={{ background: C.stampSoft, color: C.stamp }}>
            <ArrowUpRight size={14} />
          </button>
        ) : (
          <span className="p-1.5 shrink-0" title="Tarefa recorrente"><Repeat size={13} color="#9CA3AF" /></span>
        )}
      </label>
      {edit && onEdit && (
        <div className="flex items-center gap-1.5 flex-wrap px-3 pb-2 pt-1 border-t" style={{ borderColor: "#F0F1F3" }}>
          <button onClick={() => onEdit(t.id, { date: onPlusDays(t.date, 1) })}
            className="px-2 py-1 rounded-full text-xs font-medium" style={{ background: C.dateSoft, color: C.date }}>+1 dia</button>
          <button onClick={() => onEdit(t.id, { date: onPlusDays(t.date, 7) })}
            className="px-2 py-1 rounded-full text-xs font-medium" style={{ background: C.dateSoft, color: C.date }}>+1 semana</button>
          <input type="date" onChange={(e) => {
            if (!e.target.value) return;
            const [y, mo, d] = e.target.value.split("-");
            onEdit(t.id, { date: `${d}/${mo}/${y}` });
          }} className="border rounded-lg px-1.5 py-0.5 text-xs outline-none" style={{ borderColor: C.line }} />
          <select value={t.userId || ""} onChange={(e) => e.target.value && onEdit(t.id, { userId: e.target.value })}
            className="border rounded-lg px-1.5 py-1 text-xs outline-none" style={{ borderColor: C.line, background: "#fff" }}>
            {(users || []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <button onClick={() => setEdit(false)} className="px-2 py-1 rounded-full text-xs" style={{ background: "#E2E5E9", color: "#4B5563" }}>fechar</button>
        </div>
      )}
    </div>
  );
}

export default function TasksView({ meta, me, onToggle, onGo, scanning, onAddRec, onRemoveRec, onEdit, onPlusDays }) {
  const [who, setWho] = useState("mine"); // mine | all | userId
  const [when, setWhen] = useState("all"); // all | past | today | future
  const [showRec, setShowRec] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [rec, setRec] = useState({ text: "", userId: "", freq: "weekly", weekday: 1, day: 1, important: false });

  const dKey = dateKeyBR;
  const tKey = dKey(todayBR());

  const tasks = useMemo(() => {
    let list = [...(meta.tasks || [])];
    if (who === "mine") list = list.filter((t) => t.userId === me?.id);
    else if (who !== "all") list = list.filter((t) => t.userId === who);
    if (when === "past") list = list.filter((t) => dKey(t.date) && dKey(t.date) < tKey);
    if (when === "today") list = list.filter((t) => dKey(t.date) === tKey);
    if (when === "future") list = list.filter((t) => dKey(t.date) && dKey(t.date) > tKey);
    return list.sort((a, b) => {
      const ka = dKey(a.date) || "99999999", kb = dKey(b.date) || "99999999";
      if (ka !== kb) return ka.localeCompare(kb);
      return (b.important ? 1 : 0) - (a.important ? 1 : 0);
    });
  }, [meta.tasks, who, when, me]); // eslint-disable-line

  const pending = useMemo(() => tasks.filter((t) => !t.done), [tasks]);
  const doneTasks = useMemo(() => tasks.filter((t) => t.done), [tasks]);

  const groups = useMemo(() => {
    const byUser = {};
    pending.forEach((t) => {
      const key = t.userName || "Sem responsável";
      (byUser[key] = byUser[key] || []).push(t);
    });
    return byUser;
  }, [pending]);

  const userOf = (t) => meta.users.find((u) => u.id === t.userId) || null;
  const isLate = (t) => !t.done && dKey(t.date) && dKey(t.date) < tKey;
  const lateCount = tasks.filter(isLate).length;

  const [copiedRep, setCopiedRep] = useState(false);
  const repText = () => {
    const whoLabel = who === "mine" ? (me?.name || "Minhas") : who === "all" ? "Equipe completa" : (meta.users.find((u) => u.id === who)?.name || "");
    const whenLabel = { all: "todas", past: "passadas", today: "de hoje", future: "futuras" }[when];
    const fmt = (t) => `• ${t.done ? "✔️ " : ""}${t.important ? "⭐ " : ""}${t.text} ${t.date ? `(${t.date})` : "(sem prazo)"}${isLate(t) ? " ⚠️ atrasada" : ""}`;
    let txt = `*📋 PENDÊNCIAS — ${whoLabel}* _(${whenLabel})_ — ${todayBR()}\n\n`;
    if (who === "all") {
      Object.keys(groups).forEach((name) => {
        txt += `*${name}* (${groups[name].filter((t) => !t.done).length} pendente(s))\n` + groups[name].map(fmt).join("\n") + "\n\n";
      });
    } else {
      txt += tasks.map(fmt).join("\n") + "\n\n";
    }
    if (!tasks.length) txt += "• nenhuma tarefa neste filtro 👏\n\n";
    txt += `Total: ${tasks.filter((t) => !t.done).length} pendente(s)${lateCount ? ` · ${lateCount} em atraso ⚠️` : ""}\n_Planner - Gui - Finamob_`;
    return txt.trim();
  };

  const copyRep = () => {
    const ta = document.createElement("textarea");
    ta.value = repText();
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); setCopiedRep(true); setTimeout(() => setCopiedRep(false), 1500); } catch (e) {}
    document.body.removeChild(ta);
  };

  const TaskRow = (t) => <TaskItem key={t.id} t={t} onToggle={onToggle} onGo={onGo} users={meta.users} onEdit={onEdit} onPlusDays={onPlusDays} />;

  return (
    <div className="max-w-3xl mx-auto px-4 py-5">
      <h1 className="text-xl font-semibold mb-2 flex items-center gap-2" style={{ color: "#1F2937", fontFamily: "Georgia, serif" }}>
        Pendências
        {scanning && <span className="text-xs font-normal flex items-center gap-1" style={{ color: "#9CA3AF", fontFamily: "system-ui, sans-serif" }}><Loader2 size={12} className="animate-spin" /> sincronizando anotações…</span>}
      </h1>

      <div className="flex flex-wrap items-center gap-2 mb-2">
        <select value={who} onChange={(e) => setWho(e.target.value)}
          className="border rounded-lg px-2.5 py-1.5 text-sm outline-none" style={{ borderColor: C.line, background: "#fff", color: "#374151" }}>
          <option value="mine">Minhas tarefas</option>
          <option value="all">Todas as pessoas</option>
          {meta.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: C.line }}>
          {[["all", "Todas"], ["past", "Passadas"], ["today", "Hoje"], ["future", "Futuras"]].map(([v, label]) => (
            <button key={v} onClick={() => setWhen(v)} className="px-2.5 py-1.5 text-xs font-medium"
              style={when === v ? { background: C.stamp, color: "#fff" } : { background: "#fff", color: "#4B5563" }}>
              {label}
            </button>
          ))}
        </div>
        <button onClick={() => setShowRec((v) => !v)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
          style={showRec ? { background: C.stamp, color: "#fff" } : { background: "#fff", color: "#4B5563", border: `1px solid ${C.line}` }}>
          <Repeat size={13} /> Recorrentes ({(meta.recurring || []).length})
        </button>
        <button onClick={copyRep}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
          style={{ background: "#E2E5E9", color: "#374151" }}>
          {copiedRep ? <Check size={13} /> : <Copy size={13} />} {copiedRep ? "Copiado!" : "Relatório"}
        </button>
        <a href={"https://wa.me/?text=" + encodeURIComponent(repText())} target="_blank" rel="noreferrer"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white no-underline"
          style={{ background: "#1FAF57" }}>
          <Send size={13} /> WhatsApp
        </a>
      </div>

      {showRec && (
        <div className="rounded-xl border p-3 mb-4" style={{ borderColor: C.line, background: "#fff" }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#6B7280" }}>Tarefas recorrentes</p>
          {(meta.recurring || []).map((r) => (
            <div key={r.id} className="flex items-center gap-2 text-sm py-1.5 border-b" style={{ borderColor: "#F0F1F3" }}>
              <Repeat size={13} color={C.stamp} className="shrink-0" />
              <span className="flex-1" style={{ color: "#374151" }}>
                {r.important ? "⭐ " : ""}{r.text}
                <span className="text-xs" style={{ color: "#9CA3AF" }}> — {r.userName} · {r.freq === "weekly" ? `toda ${["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][r.weekday]}` : `todo dia ${r.day}`}</span>
              </span>
              <button onClick={() => onRemoveRec(r.id)} style={{ color: C.danger }}><Trash2 size={13} /></button>
            </div>
          ))}
          {(meta.recurring || []).length === 0 && <p className="text-xs mb-2" style={{ color: "#9CA3AF" }}>Nenhuma regra ainda. A tarefa reaparece automaticamente a cada período.</p>}
          <div className="flex flex-col gap-1.5 mt-2">
            <input value={rec.text} onChange={(e) => setRec({ ...rec, text: e.target.value })} placeholder="Descrição da tarefa (ex.: Enviar relatório de leads)"
              className="border rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ borderColor: C.line }} />
            <div className="flex gap-1.5 flex-wrap">
              <select value={rec.userId} onChange={(e) => setRec({ ...rec, userId: e.target.value })}
                className="border rounded-lg px-2 py-1.5 text-xs outline-none flex-1" style={{ borderColor: C.line, background: "#fff" }}>
                <option value="">Responsável…</option>
                {meta.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <select value={rec.freq} onChange={(e) => setRec({ ...rec, freq: e.target.value })}
                className="border rounded-lg px-2 py-1.5 text-xs outline-none" style={{ borderColor: C.line, background: "#fff" }}>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
              </select>
              {rec.freq === "weekly" ? (
                <select value={rec.weekday} onChange={(e) => setRec({ ...rec, weekday: +e.target.value })}
                  className="border rounded-lg px-2 py-1.5 text-xs outline-none" style={{ borderColor: C.line, background: "#fff" }}>
                  {["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"].map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              ) : (
                <input type="number" min="1" max="28" value={rec.day} onChange={(e) => setRec({ ...rec, day: +e.target.value })}
                  className="border rounded-lg px-2 py-1.5 text-xs outline-none w-20" style={{ borderColor: C.line }} placeholder="dia" />
              )}
              <label className="flex items-center gap-1 text-xs" style={{ color: "#4B5563" }}>
                <input type="checkbox" checked={rec.important} onChange={(e) => setRec({ ...rec, important: e.target.checked })} /> ⭐
              </label>
            </div>
            <button
              onClick={() => {
                if (!rec.text.trim() || !rec.userId) return;
                const u = meta.users.find((x) => x.id === rec.userId);
                onAddRec({ text: rec.text.trim(), userId: u.id, userName: u.name, freq: rec.freq, weekday: rec.weekday, day: rec.day, important: rec.important });
                setRec({ ...rec, text: "" });
              }}
              className="rounded-lg py-1.5 text-xs font-medium text-white" style={{ background: C.stamp }}>
              Adicionar recorrente
            </button>
          </div>
        </div>
      )}

      <p className="text-xs mb-4" style={{ color: "#9CA3AF" }}>
        {tasks.filter((t) => !t.done).length} pendente(s)
        {lateCount > 0 && <span style={{ color: "#A32D2D", fontWeight: 600 }}> · {lateCount} em atraso</span>}
        {" "}· ⭐ importantes primeiro · tarefas sem prazo aparecem em "Todas"
      </p>

      {pending.length === 0 && doneTasks.length === 0 && (
        <p className="text-sm" style={{ color: "#6B7280" }}>Nenhuma tarefa neste filtro.</p>
      )}

      {who === "all" ? (
        Object.keys(groups).map((name) => (
          <div key={name} className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              {groups[name][0] && userOf(groups[name][0]) ? <Avatar user={userOf(groups[name][0])} /> : null}
              <p className="text-sm font-semibold" style={{ color: "#1F2937" }}>{name}</p>
              <span className="text-xs" style={{ color: "#9CA3AF" }}>{groups[name].length} pendente(s)</span>
            </div>
            <div className="flex flex-col gap-1.5">{groups[name].map(TaskRow)}</div>
          </div>
        ))
      ) : (
        <div className="flex flex-col gap-1.5">{pending.map(TaskRow)}</div>
      )}

      {doneTasks.length > 0 && (
        <div className="mt-6 pt-3 border-t" style={{ borderColor: C.line }}>
          <button onClick={() => setShowDone((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-medium w-full"
            style={{ color: "#6B7280" }}>
            <ChevronRight size={15} style={{ transform: showDone ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
            Concluídas ({doneTasks.length})
          </button>
          {showDone && <div className="flex flex-col gap-1.5 mt-2">{doneTasks.map(TaskRow)}</div>}
        </div>
      )}
    </div>
  );
}
