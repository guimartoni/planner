import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen, CheckSquare, ChevronRight, FileText, FolderInput, Loader2,
  Menu, Pencil, Plus, RefreshCw, Trash2, X,
} from "lucide-react";
import { C, USER_COLORS, dateKeyBR, monthLabel, plusDaysBR, todayBR, uid } from "./lib/util.js";
import { SEED_BODY, bodyText, reconcileTasks, seedMeta } from "./lib/data.js";
import { usePlannerData } from "./store.js";
import Avatar from "./components/Avatar.jsx";
import Editor from "./components/Editor.jsx";
import IdentifyScreen from "./components/IdentifyScreen.jsx";
import TasksView from "./components/TasksView.jsx";
import TeamModal from "./components/TeamModal.jsx";
import TrashView from "./components/TrashView.jsx";

const APP_BUILD = "Sessão 2 · dados no OneDrive";
const ME_KEY = "planner-me-v1";

/* Normaliza os dados na carga: semente inicial, caderno Diário como
   primeira aba, subtema do mês e página de hoje. */
function prepareData(data) {
  let changed = false;
  let m = data.meta;
  let bodies = { ...(data.bodies || {}) };
  if (!m) {
    m = seedMeta();
    bodies[m._seedNoteId] = SEED_BODY;
    changed = true;
  }
  const beforeTasks = (m.tasks || []).length;
  m = { ...m, tasks: (m.tasks || []).filter((t) => t.userId) };
  if ((m.tasks || []).length !== beforeTasks) changed = true;

  let daily = m.notebooks.find((nb) => nb.daily);
  if (!daily) {
    daily = { id: uid(), name: "Diário", daily: true, sections: [{ id: uid(), name: "Anotações diárias", notes: [] }] };
    m = { ...m, notebooks: [daily, ...m.notebooks.filter((nb) => !nb.daily)] };
    changed = true;
  } else if (m.notebooks[0].id !== daily.id) {
    m = { ...m, notebooks: [daily, ...m.notebooks.filter((nb) => nb.id !== daily.id)] };
    changed = true;
  }

  const mLabel = monthLabel();
  let msec = daily.sections.find((s) => s.name === mLabel);
  if (!msec) {
    msec = { id: uid(), name: mLabel, notes: [] };
    m = {
      ...m,
      notebooks: m.notebooks.map((nb) => nb.id !== daily.id ? nb : {
        ...nb,
        sections: [msec, ...nb.sections.filter((s) => !(s.name === "Anotações diárias" && s.notes.length === 0))],
      }),
    };
    changed = true;
  }
  let today = msec.notes.find((n) => n.title === todayBR());
  if (!today) {
    today = { id: uid(), title: todayBR(), createdAt: todayBR(), concluded: false, author: "" };
    m = {
      ...m,
      notebooks: m.notebooks.map((nb) => nb.id !== daily.id ? nb : {
        ...nb,
        sections: nb.sections.map((s) => (s.id !== msec.id ? s : { ...s, notes: [today, ...s.notes] })),
      }),
    };
    bodies[today.id] = { content: "", transcript: "", structured: null };
    changed = true;
  }
  return { data: { ...data, meta: m, bodies }, changed, ids: { nbId: daily.id, secId: msec.id, noteId: today.id } };
}

export default function Planner() {
  const idsRef = useRef(null);
  const store = usePlannerData((base) => {
    const r = prepareData(base);
    idsRef.current = r.ids;
    return r;
  });
  const { cloudPhase, cloudErr, meta, setMeta, metaRef, loadBody, saveBody, deleteBodyKey, saveState, syncing, syncNow } = store;

  const [me, setMe] = useState(null);
  const [phase, setPhase] = useState("boot"); // boot | identify | ready
  const [nbId, setNbId] = useState(null);
  const [secId, setSecId] = useState(null);
  const [noteId, setNoteId] = useState(null);
  const [body, setBody] = useState(null);
  const [view, setView] = useState("editor");
  const [showSide, setShowSide] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [secEdit, setSecEdit] = useState(null);
  const [diariosOpen, setDiariosOpen] = useState(false);
  const [moveId, setMoveId] = useState(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => { setDiariosOpen(false); }, [secId]);

  /* ---------- entrada: identificar usuário e abrir o Diário de hoje ---------- */
  useEffect(() => {
    if (cloudPhase !== "pronto" || phase !== "boot") return;
    const ids = idsRef.current;
    if (ids) { setNbId(ids.nbId); setSecId(ids.secId); setNoteId(ids.noteId); }
    const myId = localStorage.getItem(ME_KEY);
    const found = myId && (metaRef.current.users || []).find((u) => u.id === myId);
    if (found) { setMe(found); setPhase("ready"); }
    else setPhase("identify");
  }, [cloudPhase]); // eslint-disable-line

  /* ---------- seletores ---------- */
  const notebook = meta?.notebooks.find((n) => n.id === nbId) || meta?.notebooks[0];
  const section = notebook?.sections.find((s) => s.id === secId) || notebook?.sections[0];
  const noteMeta = section?.notes.find((n) => n.id === noteId) || null;

  const allSections = useMemo(() => {
    if (!meta) return [];
    const list = [];
    meta.notebooks.forEach((nb) =>
      nb.sections.forEach((s) => list.push({ nbId: nb.id, secId: s.id, name: s.name, nbName: nb.name }))
    );
    return list;
  }, [meta]);

  /* ---------- abrir/salvar corpo da página ---------- */
  useEffect(() => {
    if (!noteId) { setBody(null); return; }
    setBody(loadBody(noteId) || { content: "", transcript: "", structured: null });
  }, [noteId, cloudPhase]); // eslint-disable-line

  const patchBody = (patch) => {
    setBody((b) => {
      const p = typeof patch === "function" ? patch(b) : patch;
      const next = { ...b, ...p };
      saveBody(noteId, next);
      return next;
    });
  };

  const patchNoteMeta = (patch) => {
    setMeta((m) => ({
      ...m,
      tasks: patch.title !== undefined
        ? (m.tasks || []).map((t) => (t.noteId === noteId ? { ...t, noteTitle: patch.title || "Página sem nome" } : t))
        : m.tasks,
      notebooks: m.notebooks.map((nb) => nb.id !== notebook.id ? nb : {
        ...nb,
        sections: nb.sections.map((s) => s.id !== section.id ? s : {
          ...s,
          notes: s.notes.map((n) => (n.id !== noteId ? n : { ...n, ...patch })),
        }),
      }),
    }));
  };

  /* ---------- roteamento !subtema ---------- */
  const routeLines = () => {
    const b = body;
    if (!b) return;
    const content = bodyText(b);
    if (!content.includes("!")) return;
    const routed = b.routed || [];
    const newRouted = [...routed];
    const pending = [];
    content.split("\n").forEach((raw) => {
      const line = raw.trim();
      if (!line || !line.includes("!") || routed.includes(line)) return;
      const target = allSections
        .filter((sec) => sec.secId !== secId && line.includes("!" + sec.name))
        .sort((a, z) => z.name.length - a.name.length)[0];
      if (target) { pending.push({ line, target }); newRouted.push(line); }
    });
    if (!pending.length) return;
    const groups = {};
    pending.forEach((p) => {
      const g = (groups[p.target.secId] = groups[p.target.secId] || { target: p.target, lines: [] });
      g.lines.push(p.line.replace("!" + p.target.name, "").replace(/\s{2,}/g, " ").trim());
    });
    let m = metaRef.current;
    for (const g of Object.values(groups)) {
      const nb = m.notebooks.find((n) => n.id === g.target.nbId);
      const sec = nb && nb.sections.find((s) => s.id === g.target.secId);
      if (!sec) continue;
      const title = `Diário ${todayBR()}`;
      let pg = sec.notes.find((n) => n.title === title);
      if (!pg) {
        pg = { id: uid(), title, createdAt: todayBR(), concluded: false, author: me?.name || "" };
        m = {
          ...m,
          notebooks: m.notebooks.map((n) => n.id !== nb.id ? n : {
            ...n,
            sections: n.sections.map((s) => (s.id !== sec.id ? s : { ...s, notes: [pg, ...s.notes] })),
          }),
        };
      }
      const tb = loadBody(pg.id) || { content: "", transcript: "", structured: null };
      saveBody(pg.id, { ...tb, content: (tb.content ? tb.content + "\n" : "") + g.lines.join("\n") });
    }
    if (m !== metaRef.current) setMeta(m);
    patchBody({ routed: newRouted });
  };

  /* ---------- tarefas direto das anotações ---------- */
  const syncDraftTasks = () => {
    if (!body || !noteMeta || !notebook) return;
    const m = metaRef.current;
    const cur = m.tasks || [];
    const next = reconcileTasks(cur, noteMeta, notebook.name, bodyText(body), m.users);
    if (next !== cur) setMeta((mm) => ({ ...mm, tasks: next }));
  };

  const scanAllTasks = () => {
    const m = metaRef.current;
    if (!m || scanning) return;
    setScanning(true);
    try {
      let tasks = m.tasks || [];
      for (const nb of m.notebooks) {
        for (const s of nb.sections) {
          for (const n of s.notes) {
            if (tasks.filter((t) => t.noteId === n.id).some((t) => t.origin === "ia")) continue;
            const b = n.id === noteId && body ? body : loadBody(n.id);
            tasks = reconcileTasks(tasks, n, nb.name, bodyText(b), m.users);
          }
        }
      }
      if (tasks !== (metaRef.current.tasks || [])) setMeta((mm) => ({ ...mm, tasks }));
    } catch (e) { /* segue com o que tiver */ }
    setScanning(false);
  };

  useEffect(() => {
    if (!body || !noteId) return;
    const t = setTimeout(() => { routeLines(); syncDraftTasks(); }, 1600);
    return () => clearTimeout(t);
  }, [body && body.content, body && body.blocks, noteId]); // eslint-disable-line

  /* ---------- CRUD ---------- */
  const addNotebook = (name) => {
    const nb = { id: uid(), name, sections: [{ id: uid(), name: "Geral", notes: [] }] };
    setMeta((m) => ({ ...m, notebooks: [...m.notebooks, nb] }));
    setNbId(nb.id); setSecId(nb.sections[0].id); setNoteId(null);
  };

  const renameNotebook = (id, name) => {
    setMeta((m) => ({ ...m, notebooks: m.notebooks.map((nb) => (nb.id === id ? { ...nb, name } : nb)) }));
  };

  const renameSection = (id, name) => {
    setMeta((m) => ({
      ...m,
      notebooks: m.notebooks.map((nb) => nb.id !== notebook.id ? nb : {
        ...nb,
        sections: nb.sections.map((s) => (s.id === id ? { ...s, name } : s)),
      }),
    }));
  };

  const addSection = (name) => {
    const s = { id: uid(), name, notes: [] };
    setMeta((m) => ({
      ...m,
      notebooks: m.notebooks.map((nb) => nb.id !== notebook.id ? nb : { ...nb, sections: [...nb.sections, s] }),
    }));
    setSecId(s.id); setNoteId(null);
  };

  const addNote = () => {
    const n = { id: uid(), title: "", createdAt: todayBR(), concluded: false, author: me?.name || "" };
    setMeta((m) => ({
      ...m,
      notebooks: m.notebooks.map((nb) => nb.id !== notebook.id ? nb : {
        ...nb,
        sections: nb.sections.map((s) => s.id !== section.id ? s : { ...s, notes: [n, ...s.notes] }),
      }),
    }));
    saveBody(n.id, { content: "", transcript: "", structured: null });
    setNoteId(n.id); setView("editor"); setShowSide(false);
  };

  const deleteNote = (id) => {
    const nm = section?.notes.find((n) => n.id === id);
    if (!nm) return;
    setMeta((m) => ({
      ...m,
      trash: [
        { ...nm, nbId: notebook.id, secId: section.id, nbName: notebook.name, secName: section.name, deletedAt: todayBR(), tasks: (m.tasks || []).filter((t) => t.noteId === id) },
        ...(m.trash || []),
      ],
      tasks: (m.tasks || []).filter((t) => t.noteId !== id),
      notebooks: m.notebooks.map((nb) => nb.id !== notebook.id ? nb : {
        ...nb,
        sections: nb.sections.map((s) => s.id !== section.id ? s : { ...s, notes: s.notes.filter((n) => n.id !== id) }),
      }),
    }));
    if (noteId === id) setNoteId(null);
  };

  const restoreNote = (id) => {
    setMeta((m) => {
      const entry = (m.trash || []).find((t) => t.id === id);
      if (!entry) return m;
      const { nbId: tnb, secId: tsec, nbName, secName, deletedAt, tasks: ttasks, ...nMeta } = entry;
      let placed = false;
      let notebooks = m.notebooks.map((nb) => nb.id !== tnb ? nb : {
        ...nb,
        sections: nb.sections.map((s) => {
          if (s.id !== tsec) return s;
          placed = true;
          return { ...s, notes: [nMeta, ...s.notes] };
        }),
      });
      if (!placed) {
        notebooks = notebooks.map((nb, i) => i !== 0 ? nb : {
          ...nb,
          sections: nb.sections.map((s, j) => j !== 0 ? s : { ...s, notes: [nMeta, ...s.notes] }),
        });
      }
      return { ...m, notebooks, tasks: [...(m.tasks || []), ...(ttasks || [])], trash: m.trash.filter((t) => t.id !== id) };
    });
  };

  const purgeNote = (id) => {
    deleteBodyKey(id);
    setMeta((m) => ({ ...m, trash: (m.trash || []).filter((t) => t.id !== id) }));
  };

  const emptyTrash = () => {
    (metaRef.current?.trash || []).forEach((t) => deleteBodyKey(t.id));
    setMeta((m) => ({ ...m, trash: [] }));
  };

  const addUser = (name, area, phone) => {
    const u = {
      id: uid(), name, area: area || "Geral",
      phone: (phone || "").replace(/\D/g, ""),
      color: USER_COLORS[(meta?.users.length || 0) % USER_COLORS.length],
    };
    setMeta((m) => ({ ...m, users: [...m.users, u] }));
    return u;
  };

  const updateUser = (id, patch) => {
    setMeta((m) => ({
      ...m,
      users: m.users.map((u) => (u.id === id ? { ...u, ...patch } : u)),
      tasks: patch.name
        ? (m.tasks || []).map((t) => (t.userId === id ? { ...t, userName: patch.name } : t))
        : m.tasks,
    }));
    if (me?.id === id) setMe((u) => ({ ...u, ...patch }));
  };

  /* ---------- edição inline de tarefa (reescreve a linha de origem) ---------- */
  const editTask = (taskId, patch) => {
    const m = metaRef.current;
    const t = (m.tasks || []).find((x) => x.id === taskId);
    if (!t) return;
    const newUser = patch.userId ? m.users.find((u) => u.id === patch.userId) : null;
    if (t.noteId && t.origin !== "ia") {
      const b = loadBody(t.noteId);
      if (b) {
        const oldUser = m.users.find((u) => u.id === t.userId);
        const stripLine = (line) => {
          let s = line;
          if (oldUser) s = s.split("@" + oldUser.name).join("");
          return s.replace(/📅\s*\d{2}\/\d{2}\/\d{4}/, "").replace(/\*/g, "").trim();
        };
        const rewrite = (line) => {
          let nl = line;
          if (patch.date !== undefined) {
            if (/📅\s*\d{2}\/\d{2}\/\d{4}/.test(nl)) nl = nl.replace(/📅\s*\d{2}\/\d{2}\/\d{4}/, patch.date ? `📅 ${patch.date}` : "");
            else if (patch.date) nl = nl.trimEnd() + ` 📅 ${patch.date}`;
          }
          if (newUser && oldUser) nl = nl.split("@" + oldUser.name).join("@" + newUser.name);
          return nl;
        };
        const nb2 = JSON.parse(JSON.stringify(b));
        const fields = [];
        if (typeof nb2.content === "string") fields.push({ get: () => nb2.content, set: (v) => { nb2.content = v; } });
        (nb2.blocks || []).forEach((bl) => {
          if (typeof bl.text === "string") fields.push({ get: () => bl.text, set: (v) => { bl.text = v; } });
          if (typeof bl.comment === "string") fields.push({ get: () => bl.comment, set: (v) => { bl.comment = v; } });
        });
        for (const f of fields) {
          const lines = f.get().split("\n");
          const idx = lines.findIndex((ln) => oldUser && ln.toLowerCase().includes(("@" + oldUser.name).toLowerCase()) && stripLine(ln) === t.text);
          if (idx >= 0) {
            lines[idx] = rewrite(lines[idx]);
            f.set(lines.join("\n"));
            saveBody(t.noteId, nb2);
            if (t.noteId === noteId) setBody(nb2);
            break;
          }
        }
      }
    }
    setMeta((mm) => ({
      ...mm,
      tasks: (mm.tasks || []).map((x) => x.id === taskId ? {
        ...x,
        ...(patch.date !== undefined ? { date: patch.date } : {}),
        ...(newUser ? { userId: newUser.id, userName: newUser.name } : {}),
      } : x),
    }));
  };

  const toggleTask = (taskId, done) => {
    setMeta((m) => ({ ...m, tasks: m.tasks.map((t) => (t.id === taskId ? { ...t, done } : t)) }));
  };

  const goToNote = (nId) => {
    for (const nb of meta.notebooks) {
      for (const s of nb.sections) {
        if (s.notes.some((n) => n.id === nId)) {
          setNbId(nb.id); setSecId(s.id); setNoteId(nId); setView("editor");
          return;
        }
      }
    }
  };

  /* ---------- mover páginas ---------- */
  const moveNoteTo = (nId, toNbId, toSecId) => {
    setMeta((m) => {
      let moved = null;
      let notebooks = m.notebooks.map((nb) => ({
        ...nb,
        sections: nb.sections.map((s) => {
          const found = s.notes.find((n) => n.id === nId);
          if (found) moved = found;
          return { ...s, notes: s.notes.filter((n) => n.id !== nId) };
        }),
      }));
      if (!moved) return m;
      const toNb = notebooks.find((nb) => nb.id === toNbId);
      notebooks = notebooks.map((nb) => nb.id !== toNbId ? nb : {
        ...nb,
        sections: nb.sections.map((s) => (s.id !== toSecId ? s : { ...s, notes: [moved, ...s.notes] })),
      });
      return {
        ...m, notebooks,
        tasks: (m.tasks || []).map((t) => (t.noteId === nId ? { ...t, nbName: toNb ? toNb.name : t.nbName } : t)),
      };
    });
    setMoveId(null);
    setNbId(toNbId); setSecId(toSecId); setNoteId(nId);
  };

  /* ---------- tarefas recorrentes ---------- */
  const materializeRecurring = () => {
    const m = metaRef.current;
    const rules = (m && m.recurring) || [];
    if (!rules.length) return;
    const now = new Date();
    const fmt = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    const add = [];
    rules.forEach((r) => {
      let d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (r.freq === "weekly") {
        const diff = (r.weekday - d.getDay() + 7) % 7;
        d.setDate(d.getDate() + diff);
      } else {
        d = new Date(now.getFullYear(), now.getMonth(), Math.min(r.day || 1, 28));
        if (dateKeyBR(fmt(d)) < dateKeyBR(fmt(now))) d = new Date(now.getFullYear(), now.getMonth() + 1, Math.min(r.day || 1, 28));
      }
      const dateStr = fmt(d);
      const exists = (m.tasks || []).some((t) => t.ruleId === r.id && t.date === dateStr);
      if (!exists) {
        add.push({
          id: uid(), ruleId: r.id, noteId: null, noteTitle: "Tarefa recorrente", nbName: "Rotina",
          text: r.text, userId: r.userId, userName: r.userName, date: dateStr,
          done: false, important: !!r.important, origin: "rec",
        });
      }
    });
    if (add.length) setMeta((mm) => ({ ...mm, tasks: [...(mm.tasks || []), ...add] }));
  };

  useEffect(() => { if (phase === "ready") setTimeout(materializeRecurring, 2000); }, [phase]); // eslint-disable-line

  const addRecurring = (rule) => setMeta((m) => ({ ...m, recurring: [...(m.recurring || []), { ...rule, id: uid() }] }));
  const removeRecurring = (id) => setMeta((m) => ({
    ...m,
    recurring: (m.recurring || []).filter((r) => r.id !== id),
    tasks: (m.tasks || []).filter((t) => !(t.ruleId === id && !t.done)),
  }));

  /* ---------------------------------------------------------------- */
  if (cloudPhase === "erro") {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 p-6 text-center" style={{ background: C.appBg }}>
        <p className="font-semibold" style={{ color: "#1F2937" }}>Não consegui carregar seus dados do OneDrive</p>
        <p className="text-sm max-w-sm" style={{ color: "#6B7280" }}>{cloudErr}</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: C.stamp }}>
          Tentar de novo
        </button>
      </div>
    );
  }

  if (cloudPhase !== "pronto" || !meta || phase === "boot") {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3" style={{ background: C.appBg }}>
        <Loader2 className="animate-spin" color={C.ink} />
        <p className="text-xs" style={{ color: "#6B7280" }}>Carregando seus dados do OneDrive…</p>
      </div>
    );
  }

  if (phase === "identify") {
    return (
      <IdentifyScreen
        users={meta.users}
        onPick={(u) => {
          localStorage.setItem(ME_KEY, u.id);
          setMe(u); setPhase("ready");
        }}
        onCreate={(name, area) => {
          const u = addUser(name, area);
          localStorage.setItem(ME_KEY, u.id);
          setMe(u); setPhase("ready");
        }}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: C.appBg, fontFamily: "system-ui, sans-serif" }}>
      {/* Barra superior */}
      <header className="flex items-center gap-2 px-3 py-2 shrink-0" style={{ background: C.ink }}>
        <button onClick={() => setShowSide((v) => !v)} className="p-2 rounded-lg text-white md:hidden" style={{ background: C.inkSoft }}>
          <Menu size={18} />
        </button>
        <BookOpen size={18} color={C.stampSoft} className="shrink-0 hidden sm:block" />
        <span className="text-white font-semibold hidden lg:inline whitespace-nowrap mr-1" style={{ fontFamily: "Georgia, serif" }}>Planner</span>
        <NotebookTabs meta={meta} nbId={notebook?.id} onPick={(id) => {
          const nb = meta.notebooks.find((n) => n.id === id);
          const s0 = nb.sections[0] || null;
          setNbId(id);
          setSecId(s0 ? s0.id : null);
          setNoteId(s0 && s0.notes.length ? s0.notes[0].id : null);
          setView("editor");
        }} onAdd={addNotebook} onRename={renameNotebook} />
        <div className="flex-1" />
        <button onClick={syncNow} className="p-2 rounded-lg text-white" style={{ background: C.inkSoft }} title="Sincronizar com o OneDrive">
          <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
        </button>
        <button onClick={() => {
          const opening = view !== "tasks";
          setView(opening ? "tasks" : "editor");
          if (opening) scanAllTasks();
        }}
          className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
          style={{ background: view === "tasks" ? C.stamp : C.inkSoft, color: "#fff" }}>
          <CheckSquare size={15} /> <span className="hidden md:inline">Pendências</span>
          {(() => {
            const late = (meta.tasks || []).filter((t) => !t.done && dateKeyBR(t.date) && dateKeyBR(t.date) < dateKeyBR(todayBR())).length;
            return late > 0 ? (
              <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full flex items-center justify-center text-white font-bold"
                style={{ background: "#D64541", fontSize: 10 }}>{late}</span>
            ) : null;
          })()}
        </button>
        <button onClick={() => setShowTeam(true)} className="flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg" style={{ background: C.inkSoft }}>
          <Avatar user={me} />
        </button>
      </header>

      <div className="flex flex-1 min-h-0 relative">
        {/* Sidebar */}
        <aside className={`${showSide ? "flex" : "hidden"} md:flex flex-col w-64 shrink-0 border-r absolute md:static z-20 h-full`}
          style={{ background: "#F5F6F8", borderColor: C.line }}>
          <div className="flex items-center justify-between px-3 pt-3 pb-1">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#6B7280" }}>Subtemas · {notebook?.name}</span>
            <button className="md:hidden p-1" onClick={() => setShowSide(false)}><X size={16} /></button>
          </div>
          <div className="px-2 pb-2">
            {notebook?.sections.map((s) =>
              secEdit && secEdit.id === s.id ? (
                <input key={s.id} autoFocus value={secEdit.val}
                  onChange={(e) => setSecEdit({ id: s.id, val: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { if (secEdit.val.trim()) renameSection(s.id, secEdit.val.trim()); setSecEdit(null); }
                    if (e.key === "Escape") setSecEdit(null);
                  }}
                  onBlur={() => { if (secEdit.val.trim()) renameSection(s.id, secEdit.val.trim()); setSecEdit(null); }}
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none mb-0.5" style={{ borderColor: C.stamp }} />
              ) : (
                <button key={s.id} onClick={() => { setSecId(s.id); setNoteId(s.notes.length ? s.notes[0].id : null); setView("editor"); }}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm mb-0.5 flex items-center justify-between gap-1.5"
                  style={s.id === section?.id ? { background: C.stampSoft, color: C.stamp, fontWeight: 600 } : { color: "#374151" }}>
                  <span className="truncate flex-1">{s.name}</span>
                  {s.id === section?.id && (
                    <span onClick={(e) => { e.stopPropagation(); setSecEdit({ id: s.id, val: s.name }); }}
                      className="opacity-50 hover:opacity-100" title="Renomear subtema">
                      <Pencil size={11} />
                    </span>
                  )}
                  <span className="text-xs opacity-60">{s.notes.length}</span>
                </button>
              )
            )}
            <InlineAdd placeholder="Novo subtema" onAdd={addSection} />
          </div>
          <div className="border-t mx-3" style={{ borderColor: C.line }} />
          <div className="flex items-center justify-between px-3 pt-3 pb-1">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#6B7280" }}>Páginas</span>
            <button onClick={addNote} className="p-1 rounded-md" style={{ background: C.stamp, color: "#fff" }}><Plus size={14} /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            {section?.notes.length === 0 && (
              <p className="text-xs px-3 py-4" style={{ color: "#9CA3AF" }}>Nenhuma página neste subtema. Toque em + para criar a primeira.</p>
            )}
            {(() => {
              const isDia = (n) => (n.title || "").startsWith("Diário ");
              const notes = section?.notes || [];
              const regulares = notes.filter((n) => !isDia(n));
              const diarios = notes.filter(isDia).sort((a, b) => {
                const k = (n) => ((n.title.match(/(\d{2})\/(\d{2})\/(\d{4})/) || []).slice(1).reverse().join("") || "");
                return k(b).localeCompare(k(a));
              });
              const row = (n, sub) => (
                <div key={n.id} onClick={() => { setNoteId(n.id); setView("editor"); setShowSide(false); }}
                  className="px-3 py-2 rounded-lg mb-0.5 cursor-pointer group flex items-start justify-between gap-2"
                  style={{ ...(n.id === noteId ? { background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.08)" } : {}), ...(sub ? { marginLeft: 16 } : {}) }}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: n.title ? "#1F2937" : "#9CA3AF" }}>
                      {sub ? n.title.replace("Diário ", "") : (n.title || "Página sem nome")}
                    </p>
                    <p className="text-xs flex items-center gap-1.5" style={{ color: "#9CA3AF" }}>
                      {n.createdAt}
                      {!sub && n.author ? <span>· {n.author.split(" ")[0]}</span> : null}
                      {n.concluded && <span className="px-1.5 rounded text-white" style={{ background: C.stamp, fontSize: 10 }}>ata gerada</span>}
                    </p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setMoveId(n.id); }}
                    className="opacity-40 group-hover:opacity-100 p-1 shrink-0" title="Mover página" style={{ color: C.stamp }}>
                    <FolderInput size={13} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); deleteNote(n.id); }}
                    className="opacity-40 group-hover:opacity-100 p-1 shrink-0" style={{ color: C.danger }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              );
              return (
                <>
                  {regulares.map((n) => row(n, false))}
                  {diarios.length > 0 && (
                    <>
                      <button onClick={() => setDiariosOpen((v) => !v)}
                        className="w-full flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ color: C.stamp }}>
                        <ChevronRight size={12} style={{ transform: diariosOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
                        Diários
                        <span className="opacity-60 font-normal">({diarios.length})</span>
                      </button>
                      {diariosOpen && diarios.map((n) => row(n, true))}
                    </>
                  )}
                </>
              );
            })()}
          </div>
          <div className="border-t px-2 py-2" style={{ borderColor: C.line }}>
            <button onClick={() => { setView("trash"); setNoteId(null); setShowSide(false); }}
              className="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2"
              style={view === "trash" ? { background: "#FBE9E7", color: C.danger, fontWeight: 600 } : { color: "#6B7280" }}>
              <Trash2 size={14} /> Lixeira
              <span className="ml-auto text-xs opacity-60">{(meta.trash || []).length}</span>
            </button>
          </div>
        </aside>

        {/* Conteúdo */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          {view === "trash" ? (
            <TrashView meta={meta} onRestore={restoreNote} onPurge={purgeNote} onEmpty={emptyTrash} />
          ) : view === "tasks" ? (
            <TasksView meta={meta} me={me} onToggle={toggleTask} onGo={goToNote} scanning={scanning}
              onAddRec={addRecurring} onRemoveRec={removeRecurring} onEdit={editTask} onPlusDays={plusDaysBR} />
          ) : !noteMeta ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 px-8 text-center">
              <FileText size={40} color="#C3C8CF" />
              <p className="text-sm" style={{ color: "#6B7280" }}>
                Selecione uma página no menu ou crie uma nova para começar a anotar.
              </p>
              <button onClick={addNote} className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: C.stamp }}>
                Criar página
              </button>
            </div>
          ) : !body ? (
            <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin" color={C.ink} /></div>
          ) : (
            <Editor
              noteMeta={noteMeta} body={body} users={meta.users}
              sections={allSections.filter((s) => s.secId !== secId)}
              onTitle={(t) => patchNoteMeta({ title: t })} onMeta={patchNoteMeta} saveState={saveState}
              onBody={patchBody}
            />
          )}
        </main>
      </div>

      {moveId && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-4" style={{ background: "rgba(20,26,38,.5)" }} onClick={() => setMoveId(null)}>
          <div className="w-full max-w-sm rounded-2xl p-5 max-h-full overflow-y-auto" style={{ background: "#fff" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold" style={{ color: "#1F2937" }}>Mover página para…</h2>
              <button onClick={() => setMoveId(null)}><X size={18} /></button>
            </div>
            {meta.notebooks.map((nb) => (
              <div key={nb.id} className="mb-3">
                <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: C.stamp }}>{nb.name}</p>
                <div className="flex flex-col gap-1">
                  {nb.sections.map((s) => (
                    <button key={s.id} onClick={() => moveNoteTo(moveId, nb.id, s.id)}
                      disabled={s.id === secId && section && section.notes.some((n) => n.id === moveId)}
                      className="text-left px-3 py-2 rounded-lg text-sm border"
                      style={{ borderColor: C.line, color: "#374151", background: "#fff" }}>
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showTeam && (
        <TeamModal
          users={meta.users} me={me}
          onClose={() => setShowTeam(false)}
          onAdd={(name, area) => addUser(name, area)}
          onUpdate={updateUser}
          onRemove={(id) => setMeta((m) => ({ ...m, users: m.users.filter((u) => u.id !== id) }))}
          onSwitch={() => { setShowTeam(false); localStorage.removeItem(ME_KEY); setPhase("identify"); }}
          buildLabel={APP_BUILD}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
function NotebookTabs({ meta, nbId, onPick, onAdd, onRename }) {
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState("");
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState("");

  const commitEdit = () => {
    if (editId && editVal.trim()) onRename(editId, editVal.trim());
    setEditId(null);
  };

  return (
    <div className="flex items-center gap-1 overflow-x-auto min-w-0">
      {meta.notebooks.map((nb) =>
        editId === nb.id ? (
          <input key={nb.id} autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") setEditId(null);
            }}
            onBlur={commitEdit}
            className="px-2 py-1 rounded text-sm w-32 outline-none shrink-0" style={{ background: "#fff", color: C.ink }} />
        ) : (
          <button key={nb.id} onClick={() => onPick(nb.id)}
            className="px-3 py-1.5 rounded-lg text-sm whitespace-nowrap flex items-center gap-1.5"
            style={nb.id === nbId ? { background: "#F5F6F8", color: C.ink, fontWeight: 600 } : { color: "#B8BFCC" }}>
            {nb.name}
            {nb.id === nbId && (
              <span onClick={(e) => { e.stopPropagation(); setEditId(nb.id); setEditVal(nb.name); }}
                className="opacity-50 hover:opacity-100" title="Renomear área">
                <Pencil size={11} />
              </span>
            )}
          </button>
        )
      )}
      {adding ? (
        <input autoFocus value={val} onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && val.trim()) { onAdd(val.trim()); setVal(""); setAdding(false); }
            if (e.key === "Escape") setAdding(false);
          }}
          onBlur={() => setAdding(false)}
          placeholder="Nova área…"
          className="px-2 py-1 rounded text-sm w-28 outline-none shrink-0" style={{ background: C.inkSoft, color: "#fff" }} />
      ) : (
        <button onClick={() => setAdding(true)} className="p-1.5 rounded-lg shrink-0" style={{ color: "#B8BFCC" }}><Plus size={16} /></button>
      )}
    </div>
  );
}

function InlineAdd({ placeholder, onAdd }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-1" style={{ color: "#9CA3AF" }}>
        <Plus size={12} /> {placeholder}
      </button>
    );
  }
  return (
    <input autoFocus value={val} onChange={(e) => setVal(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && val.trim()) { onAdd(val.trim()); setVal(""); setOpen(false); }
        if (e.key === "Escape") setOpen(false);
      }}
      onBlur={() => setOpen(false)}
      placeholder={placeholder}
      className="w-full px-3 py-1.5 rounded-lg text-sm border outline-none mb-1" style={{ borderColor: C.line }} />
  );
}
