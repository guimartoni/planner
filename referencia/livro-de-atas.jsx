import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Plus, Mic, Square, Users, CheckSquare, Menu, X, Sparkles,
  Loader2, Trash2, Copy, FileText, Check, BookOpen, Pencil, RefreshCw, UserCircle2, ChevronRight, Star, ArrowUpRight, CalendarDays, ClipboardList, Send, Search as SearchIcon, FolderInput, Repeat
} from "lucide-react";

const dateKeyBR = (d) => (d ? d.split("/").reverse().join("") : null);
const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/* ------------------------------------------------------------------ */
/* Design tokens                                                       */
/* ------------------------------------------------------------------ */
const C = {
  ink: "#141A26",
  inkSoft: "#1E2736",
  appBg: "#EDEFF2",
  paper: "#FBFBF8",
  line: "#D9DDE3",
  stamp: "#1E6B4F",
  stampSoft: "#E4F1EB",
  mention: "#4338CA",
  mentionSoft: "#E7E7FB",
  date: "#B45309",
  dateSoft: "#FBEEDB",
  danger: "#B3372F",
};

const USER_COLORS = ["#4338CA", "#1E6B4F", "#B45309", "#9D2960", "#0E6E8C", "#5B4A9E", "#8A5A00", "#2E6BB0"];

const uid = () => Math.random().toString(36).slice(2, 10);

const todayBR = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const monthLabel = (d = new Date()) => `${MESES[d.getMonth()]} ${d.getFullYear()}`;

const FARMING_BLOCKS = () => ([
  { id: uid(), type: "list", title: "📍 VISITAS REALIZADAS NA SEMANA", rows: [] },
  { id: uid(), type: "table", title: "📅 VISITAS AGENDADAS", cols: ["Incorporadora", "Data", "Cidade/UF"], rows: [] },
  { id: uid(), type: "table", title: "🔜 VISITAS A AGENDAR", cols: ["Incorporadora", "Previsão", "Observação"], rows: [] },
  { id: uid(), type: "table", title: "📞 CALLS DE PIPE REALIZADAS", cols: ["Incorporadora", "Nº operações", "Pendência"], rows: [] },
  { id: uid(), type: "table", title: "📞 CALLS DE PIPE A REALIZAR", cols: ["Incorporadora", "Observação"], rows: [] },
  { id: uid(), type: "sql", title: "💰 SQL — COMITÊ", comite: "", aprovados: [], ressalvados: [], reprovados: [] },
  { id: uid(), type: "table", title: "💰 SQL — A APRESENTAR", cols: ["Incorporadora", "Volume (M)"], rows: [] },
  { id: uid(), type: "text", title: "📌 TEMA GERAL / OUTROS ASSUNTOS", text: "" },
]);

const INBOUND_BLOCKS = () => ([
  { id: uid(), type: "metric", title: "🤝 REUNIÕES DA SEMANA", value: "" },
  { id: uid(), type: "metric", title: "📥 LEADS INBOUND", value: "" },
  { id: uid(), type: "metric", title: "🔁 LEADS REMARKETING", value: "" },
  { id: uid(), type: "sql", title: "💰 SQL — COMITÊ", comite: "", aprovados: [], ressalvados: [], reprovados: [] },
  { id: uid(), type: "table", title: "💰 SQL — A APRESENTAR", cols: ["Incorporadora", "Volume (M)"], rows: [] },
  { id: uid(), type: "text", title: "📌 TEMA GERAL / OUTROS ASSUNTOS", text: "" },
]);

const PARCERIAS_BLOCKS = () => ([
  { id: uid(), type: "check", title: "🗓 FUP SEMANAL (SEGUNDAS) COM PARCEIROS", checked: false },
  { id: uid(), type: "check", title: "🤖 DISPAROS SEMANAIS PARCEIROS (AI)", checked: false },
  { id: uid(), type: "table", title: "☕ CAFÉ DA MANHÃ / TALK PARCEIROS DO MÊS", cols: ["Parceiro", "Data"], rows: [] },
  { id: uid(), type: "sql", title: "💰 SQL — COMITÊ ANTERIOR", comite: "", aprovados: [], ressalvados: [], reprovados: [] },
  { id: uid(), type: "table", title: "💰 SQL — A APRESENTAR", cols: ["Incorporadora", "Volume (M)"], rows: [] },
  { id: uid(), type: "table", title: "📞 CALLS REALIZADAS COM PARCEIROS NA SEMANA", cols: ["Parceiro", "Observação"], rows: [] },
  { id: uid(), type: "table", title: "📞 CALLS REALIZADAS COM CLIENTES NA SEMANA", cols: ["Cliente", "Observação"], rows: [] },
  { id: uid(), type: "list", title: "🤝 NOVOS PARCEIROS CONTRATADOS NA SEMANA", rows: [] },
  { id: uid(), type: "text", title: "📌 COMENTÁRIOS GERAIS", text: "" },
]);


/* Funde dois estados do app sem perder criações de nenhum lado.
   Regra: união por id (páginas, tarefas, pessoas, modelos, recorrentes);
   a lixeira funciona como lápide — o que está nela não ressuscita. */
function mergeMeta(local, remote) {
  const byId = (arr) => { const m = {}; (arr || []).forEach((x) => { m[x.id] = x; }); return m; };
  const trashIds = new Set([...(local.trash || []), ...(remote.trash || [])].map((t) => t.id));
  const unionById = (l, r) => {
    const lm = byId(l); const out = [...(l || [])];
    (r || []).forEach((x) => { if (!lm[x.id]) out.push(x); });
    return out;
  };
  const mergeNotes = (ln, rn) => {
    const lm = byId(ln);
    const out = (ln || []).filter((n) => !trashIds.has(n.id));
    (rn || []).forEach((n) => { if (!lm[n.id] && !trashIds.has(n.id)) out.push(n); });
    return out;
  };
  const mergeSections = (ls, rs) => {
    const rm = byId(rs);
    const lm = byId(ls);
    const out = (ls || []).map((s) => rm[s.id]
      ? { ...s, notes: mergeNotes(s.notes, rm[s.id].notes) }
      : { ...s, notes: (s.notes || []).filter((n) => !trashIds.has(n.id)) });
    (rs || []).forEach((s) => {
      if (!lm[s.id]) out.push({ ...s, notes: (s.notes || []).filter((n) => !trashIds.has(n.id)) });
    });
    return out;
  };
  const mergeNbs = (lb, rb) => {
    const rm = byId(rb);
    const lm = byId(lb);
    const out = (lb || []).map((nb) => rm[nb.id] ? { ...nb, sections: mergeSections(nb.sections, rm[nb.id].sections) } : nb);
    (rb || []).forEach((nb) => { if (!lm[nb.id]) out.push(nb); });
    return out;
  };
  return {
    ...remote,
    ...local,
    notebooks: mergeNbs(local.notebooks, remote.notebooks),
    trash: unionById(local.trash, remote.trash),
    tasks: unionById(local.tasks, remote.tasks),
    users: unionById(local.users, remote.users),
    templates: unionById(local.templates, remote.templates),
    recurring: unionById(local.recurring, remote.recurring),
  };
}

function blocksToText(blocks) {
  if (!blocks || !blocks.length) return "";
  return blocks.map((b) => {
    let base = "";
    if (b.type === "metric") base = `${b.title}: ${b.value || "?"}`;
    else if (b.type === "check") base = `${b.title}: ${b.checked ? "Realizado ✔" : "Não realizado ✖"}`;
    else if (b.type === "text") base = `${b.title}:\n${b.text || ""}`;
    else if (b.type === "list") base = `${b.title}:\n${(b.rows || []).map((r, i) => `${i + 1}. ${r}`).join("\n")}`;
    else if (b.type === "table") base = `${b.title} (${(b.cols || []).join(" · ")}):\n${(b.rows || []).map((r) => "- " + r.filter(Boolean).join(" · ")).join("\n")}`;
    else if (b.type === "sql") {
      const g = (name, arr) => `${name}:\n${(arr || []).map((r) => `\t${r[0]} - ${r[1]}M`).join("\n")}`;
      base = `${b.title} (último comitê: ${b.comite || "?"})\n${g("APROVADOS", b.aprovados)}\n${g("RESSALVADOS", b.ressalvados)}\n${g("REPROVADOS", b.reprovados)}`;
    }
    if (b.comment && b.comment.trim()) base += `\nComentários: ${b.comment.trim()}`;
    return base;
  }).join("\n\n");
}

const bodyText = (b) => (!b ? "" : [blocksToText(b.blocks), b.content].filter((x) => x && x.trim()).join("\n\n"));

function compareBlocks(prev, cur) {
  const facts = [];
  const norm = (s) => (s || "").trim().toLowerCase();
  const num = (s) => { const m = String(s || "").replace(",", ".").match(/[\d.]+/); return m ? parseFloat(m[0]) : 0; };
  const fmtN = (n) => String(Math.round(n * 10) / 10).replace(".", ",");
  (cur || []).forEach((cb) => {
    const pb = (prev || []).find((x) => x.id === cb.id || x.title === cb.title);
    if (!pb) return;
    if (cb.type === "list" || cb.type === "table") {
      const names = (b) => (b.rows || []).map((r) => (Array.isArray(r) ? r[0] : r)).filter(Boolean);
      const pRaw = names(pb), cRaw = names(cb);
      const pN = pRaw.map(norm), cN = cRaw.map(norm);
      const added = cRaw.filter((n) => !pN.includes(norm(n)));
      const removed = pRaw.filter((n) => !cN.includes(norm(n)));
      facts.push(`${cb.title}: ${cRaw.length} itens (antes ${pRaw.length}); entraram: ${added.join(", ") || "nenhum"}; saíram: ${removed.join(", ") || "nenhum"}`);
      if (/agendar|a realizar/i.test(cb.title)) {
        const stag = cRaw.filter((n) => pN.includes(norm(n)));
        if (stag.length) facts.push(`${cb.title} — repetem da semana anterior sem evolução: ${stag.join(", ")}`);
      }
      if (Array.isArray((cb.rows || [])[0]) && cb.cols) {
        cb.cols.forEach((c, ci) => {
          if (/opera|volume|valor|\(m\)|n[ºo]/i.test(c)) {
            const sum = (b) => (b.rows || []).reduce((a, r) => a + num(r[ci]), 0);
            const sc = sum(cb), sp = sum(pb);
            if (sc || sp) facts.push(`${cb.title} — total de "${c}": ${fmtN(sc)} (antes ${fmtN(sp)}, Δ ${sc - sp >= 0 ? "+" : ""}${fmtN(sc - sp)})`);
          }
        });
      }
    }
    if (cb.type === "check") {
      if (!!cb.checked !== !!pb.checked) facts.push(`${cb.title}: ${cb.checked ? "passou a Realizado" : "voltou a Não realizado"}`);
    }
    if (cb.type === "metric") {
      const c = num(cb.value), p = num(pb.value);
      if (c || p) facts.push(`${cb.title}: ${fmtN(c)} (antes ${fmtN(p)}, Δ ${c - p >= 0 ? "+" : ""}${fmtN(c - p)})`);
    }
    if (cb.type === "sql") {
      ["aprovados", "ressalvados", "reprovados"].forEach((g) => {
        const sum = (b) => (b[g] || []).reduce((a, r) => a + num(r[1]), 0);
        facts.push(`SQL ${g.toUpperCase()}: ${fmtN(sum(cb))}M no comitê ${cb.comite || "?"} vs ${fmtN(sum(pb))}M no comitê ${pb.comite || "?"}`);
      });
    }
  });
  return facts;
}

const FARMING_SKELETON = `VISITAS REALIZADAS SEMANA:

1. 

VISITAS AGENDADAS:

1) 

VISITAS A AGENDAR

- 

CALLS DE PIPE REALIZADAS: (X operações mapeadas)

1- 

CALLS DE PIPE A REALIZAR

1 

SQL - (último comitê apresentado)
APROVADOS
	
RESSALVADOS
	
REPROVADOS
	

SQL (desta semana)
A APRESENTAR
	

LISTA PRIVATE (atualização semanal)


OUTROS ASSUNTOS


Conferir planilha de visitas / reuniões de pipe / projetos mapeados.`;

/* ------------------------------------------------------------------ */
/* Storage compartilhado                                               */
/* ------------------------------------------------------------------ */
const sGet = async (key, shared) => {
  try {
    const r = await window.storage.get(key, !!shared);
    return r && r.value ? JSON.parse(r.value) : null;
  } catch (e) { return null; }
};
const sSet = (key, val, shared) =>
  window.storage.set(key, JSON.stringify(val), !!shared).catch(() => {});
const sDel = (key, shared) =>
  window.storage.delete(key, !!shared).catch(() => {});

const APP_BUILD = "build 31/07-f · restauração 100% automática";
const META_KEY = "livro-meta-v2";
const noteKey = (id) => `livro-note-${id}`;

/* ------------------------------------------------------------------ */
/* Dados iniciais compartilhados                                       */
/* ------------------------------------------------------------------ */
function seedMeta() {
  const nId = uid();
  return {
    users: [],
    notebooks: [
      {
        id: uid(), name: "Comercial",
        sections: [
          { id: uid(), name: "Reuniões semanais", notes: [{ id: nId, title: "Página de exemplo", createdAt: todayBR(), concluded: false }] },
          { id: uid(), name: "Clientes-chave", notes: [] },
        ],
      },
      { id: uid(), name: "Operações", sections: [{ id: uid(), name: "Rotina", notes: [] }] },
    ],
    tasks: [],
    _seedNoteId: nId,
  };
}

const SEED_BODY = {
  content:
    "Escreva livremente, como no OneNote.\n\nDigite @ para delegar uma tarefa a alguém da equipe e /data para marcar um prazo.\n\nAo final, toque em \"Concluir ata\" e a IA gera a ata padrão com resumo, decisões e ações.",
  transcript: "",
  structured: null,
};

/* ------------------------------------------------------------------ */
/* Parsing de tarefas no rascunho                                      */
/* ------------------------------------------------------------------ */
function parseDraftTasks(content, users) {
  const tasks = [];
  (content || "").split("\n").forEach((line) => {
    users.forEach((u) => {
      const tag = "@" + u.name;
      const idx = line.toLowerCase().indexOf(tag.toLowerCase());
      if (idx !== -1) {
        const dm = line.match(/📅\s*(\d{2}\/\d{2}\/\d{4})/);
        const important = line.includes("*");
        const text = (line.slice(0, idx) + line.slice(idx + tag.length))
          .replace(/📅\s*\d{2}\/\d{2}\/\d{4}/, "")
          .replace(/\*/g, "")
          .trim();
        tasks.push({ user: u, text: text || "(tarefa sem descrição)", date: dm ? dm[1] : null, important });
      }
    });
  });
  return tasks;
}

/* Reconcilia as tarefas de uma página com as linhas atuais das anotações */
function reconcileTasks(allTasks, note, nbName, content, users) {
  const existing = allTasks.filter((t) => t.noteId === note.id);
  if (existing.some((t) => t.origin === "ia")) return allTasks; // ata gerada: IA manda
  const drafts = parseDraftTasks(content, users);
  if (!drafts.length && !existing.length) return allTasks;
  const sig = (t) => `${t.userId}|${t.text}|${t.date || ""}|${t.important ? 1 : 0}`;
  const pools = {};
  existing.forEach((t) => { (pools[sig(t)] = pools[sig(t)] || []).push(t); });
  let changed = drafts.length !== existing.length;
  const next = drafts.map((d) => {
    const s = `${d.user.id}|${d.text}|${d.date || ""}|${d.important ? 1 : 0}`;
    const pool = pools[s];
    if (pool && pool.length) return pool.shift();
    changed = true;
    return {
      id: uid(), noteId: note.id, noteTitle: note.title || "Página sem nome", nbName,
      text: d.text, userId: d.user.id, userName: d.user.name,
      date: d.date, done: false, important: d.important, origin: "draft",
    };
  });
  if (!changed) return allTasks;
  return [...allTasks.filter((t) => t.noteId !== note.id), ...next];
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */
export default function App() {
  const [meta, setMetaRaw] = useState(null);
  const [me, setMe] = useState(null); // user object
  const [phase, setPhase] = useState("loading"); // loading | identify | ready
  const [nbId, setNbId] = useState(null);
  const [secId, setSecId] = useState(null);
  const [noteId, setNoteId] = useState(null);
  const [body, setBody] = useState(null); // corpo da ata aberta
  const [view, setView] = useState("editor");
  const [showSide, setShowSide] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [secEdit, setSecEdit] = useState(null); // {id, val}
  const [diariosOpen, setDiariosOpen] = useState(false);

  useEffect(() => { setDiariosOpen(false); }, [secId]);
  const [structuring, setStructuring] = useState(false);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const metaRef = useRef(null);
  const metaTimer = useRef(null);
  const bodyTimer = useRef(null);
  const lastSaved = useRef("");
  const bodyCache = useRef({});
  const [tmbKey, setTmbKeyState] = useState("");
  const saveTmbKey = (k) => { setTmbKeyState(k); sSet("tmb-key-v1", k, false); };

  const loadBody = async (id) => {
    if (bodyCache.current[id]) return bodyCache.current[id];
    let b = await sGet(noteKey(id), false);
    if (!b) {
      b = await sGet(noteKey(id), true); // migra da versão compartilhada antiga
      if (b) sSet(noteKey(id), b, false);
    }
    if (b) bodyCache.current[id] = b;
    return b;
  };

  /* ---------- salvar meta (compartilhado) ---------- */
  const setMeta = useCallback((updater) => {
    setMetaRaw((m) => {
      const next = typeof updater === "function" ? updater(m) : updater;
      metaRef.current = next;
      clearTimeout(metaTimer.current);
      metaTimer.current = setTimeout(async () => {
        let toSave = metaRef.current;
        try {
          const remote = await sGet(META_KEY, false);
          if (remote && JSON.stringify(remote) !== lastSaved.current) {
            toSave = mergeMeta(metaRef.current, remote);
            metaRef.current = toSave;
            setMetaRaw(toSave);
          }
        } catch (e) {}
        lastSaved.current = JSON.stringify(toSave);
        sSet(META_KEY, toSave, false);
      }, 700);
      return next;
    });
  }, []);

  /* ---------- carga inicial ---------- */
  useEffect(() => {
    (async () => {
      let m = await sGet(META_KEY, false);
      if (!m) {
        m = await sGet(META_KEY, true); // migra dados da versão compartilhada antiga
      }
      if (!m) {
        m = seedMeta();
        await sSet(noteKey(m._seedNoteId), SEED_BODY, false);
      }
      // chave TextMeBot: mover para o armazenamento pessoal do gestor
      let tk = await sGet("tmb-key-v1", false);
      if (!tk && m.tmbKey) { tk = m.tmbKey; await sSet("tmb-key-v1", tk, false); }
      if (m.tmbKey) { const { tmbKey: _drop, ...rest } = m; m = rest; }
      setTmbKeyState(tk || "");
      if (!m.templates) m = { ...m, templates: [] };
      if (!m.templates.some((t) => t.v === 2)) {
        m = {
          ...m,
          templates: [
            { id: uid(), name: "FUP Semanal — Farming", v: 2, blocksDef: FARMING_BLOCKS() },
            ...m.templates.filter((t) => t.name !== "FUP Semanal — Farming"),
          ],
        };
      }
      if (!m.templates.some((t) => /inbound/i.test(t.name))) {
        m = { ...m, templates: [...m.templates, { id: uid(), name: "FUP Semanal — Inbound", v: 2, blocksDef: INBOUND_BLOCKS() }] };
      }
      if (!m.templates.some((t) => /parceria/i.test(t.name))) {
        m = { ...m, templates: [...m.templates, { id: uid(), name: "FUP Semanal — Parcerias", v: 2, blocksDef: PARCERIAS_BLOCKS() }] };
      }

      // Seed único: página FUP Farming de 20/07 já preenchida
      const seeded = await sGet("fup-seed-2007", false);
      if (!seeded) {
        const ftpl = m.templates.find((t) => t.v === 2 && /farming/i.test(t.name));
        if (ftpl && ftpl.blocksDef && ftpl.blocksDef.length >= 8) {
          let tgtNb = null, tgtSec = null;
          m.notebooks.forEach((nb) => nb.sections.forEach((s) => { if (!tgtSec && /farming/i.test(s.name)) { tgtNb = nb; tgtSec = s; } }));
          if (!tgtSec) {
            tgtNb = m.notebooks.find((nb) => !nb.daily) || m.notebooks[0];
            tgtSec = { id: uid(), name: "Farming", notes: [] };
            m = { ...m, notebooks: m.notebooks.map((nb) => nb.id !== tgtNb.id ? nb : { ...nb, sections: [...nb.sections, tgtSec] }) };
          }
          const B = JSON.parse(JSON.stringify(ftpl.blocksDef));
          B[0].rows = ["FYP", "MAXIMO ALDANA", "CAPITAL CONCRETO", "BSV"];
          B[1].rows = [["Tuma", "28/07", "ES"], ["HCX", "28/07", "ES"], ["ARIAH", "28/07", "ES"], ["EPURA", "29/07", "ES"], ["Mazutti", "05/08", "Rondônia"], ["CAPREM", "11/08", "Rio Claro"], ["Proxx", "12/08", "SP"], ["Domma", "09/09", "RJ"], ["Joama", "10/09", "RJ"], ["Habitare", "10/09", "RJ"]];
          B[1].comment = "Meta: buscar +3 para agendar na próxima semana";
          B[2].rows = [["ALTUS", "2ª semana de agosto", ""], ["REV3", "setembro", ""], ["INTEGRA", "", "Luigi e parceira — Lucas não conseguiram"], ["Rondônia e Uberlândia", "agosto", ""], ["Goiânia", "setembro", ""]];
          B[3].rows = [["CP8", "1", ""], ["ADS", "1", ""], ["CAPITAL CONCRETO", "5", ""], ["VISTA 1942", "5", "falta adicionar cards"], ["ADR", "1", ""], ["JJH", "2", ""], ["ENKAN", "2", ""], ["MAGEN", "1", ""], ["Habitare", "2", ""], ["Porto Seguro", "1", ""], ["HBT", "1", "falta adicionar cards"], ["GWP", "1", "falta adicionar card"]];
          B[3].comment = "20 operações mapeadas";
          B[4].rows = [["BCANTON", ""], ["CITZ", ""], ["PROXX", ""], ["ERJ", ""], ["Alumbra", "cliente forte, 6 bi de VGV a lançar"], ["Maxplural", ""], ["Lumis", ""]];
          B[5].comite = ""; B[5].aprovados = [["FYP", "16"], ["Domma", "6"], ["Newproxx", "17"]]; B[5].ressalvados = [["REACTY SCPS", "4"], ["EDIFIC SCPS", "5"]]; B[5].reprovados = [["TAP", "15"]]; B[5].comment = "SQL 39M — último comitê apresentado";
          B[6].rows = [["SWA", "90"], ["HABITARE", "22"], ["FYP", "79"], ["JJH", "7,8"], ["EDIFIC", "5"], ["REACTY", "4 a 5"]];
          B[7].text = "LISTA PRIVATE (atualização semanal)\n\nPDA CONSTRUSUMMIT — repassado.\n\nConferir planilha de visitas / reuniões de pipe / projetos mapeados.";
          const pg = { id: uid(), title: `${ftpl.name} — 20/07/2026`, createdAt: "20/07/2026", concluded: false, templateId: ftpl.id, participants: "", author: "" };
          m = { ...m, notebooks: m.notebooks.map((nb) => nb.id !== tgtNb.id ? nb : { ...nb, sections: nb.sections.map((s) => (s.id !== tgtSec.id ? s : { ...s, notes: [pg, ...s.notes] })) }) };
          const bodyPg = { content: "", transcript: "", structured: null, blocks: B };
          bodyCache.current[pg.id] = bodyPg;
          await sSet(noteKey(pg.id), bodyPg, false);
        }
        await sSet("fup-seed-2007", "1", false);
      }
      // Tarefa só existe com responsável delegado: limpar as criadas sem
      m = { ...m, tasks: (m.tasks || []).filter((t) => t.userId) };
      // Garantir o caderno Diário como primeira aba
      let daily = m.notebooks.find((nb) => nb.daily);
      if (!daily) {
        daily = { id: uid(), name: "Diário", daily: true, sections: [{ id: uid(), name: "Anotações diárias", notes: [] }] };
        m = { ...m, notebooks: [daily, ...m.notebooks.filter((nb) => !nb.daily)] };
      } else {
        m = { ...m, notebooks: [daily, ...m.notebooks.filter((nb) => nb.id !== daily.id)] };
      }
      // Garantir o subtema do mês e a página de hoje no Diário
      const mLabel = monthLabel();
      let msec = daily.sections.find((s) => s.name === mLabel);
      if (!msec) {
        msec = { id: uid(), name: mLabel, notes: [] };
        m = { ...m, notebooks: m.notebooks.map((nb) => nb.id !== daily.id ? nb : { ...nb, sections: [msec, ...nb.sections.filter((s) => !(s.name === "Anotações diárias" && s.notes.length === 0))] }) };
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
        await sSet(noteKey(today.id), { content: "", transcript: "", structured: null }, false);
      }
      await sSet(META_KEY, m, false);
      metaRef.current = m;
      lastSaved.current = JSON.stringify(m);
      setMetaRaw(m);
      setNbId(daily.id);
      setSecId(msec.id);
      setNoteId(today.id);

      const myId = await sGet("livro-me-v1", false);
      const found = myId && m.users.find((u) => u.id === myId);
      if (found) { setMe(found); setPhase("ready"); }
      else setPhase("identify");
    })();
  }, []);

  /* ---------- sincronização periódica ---------- */
  useEffect(() => {
    if (phase !== "ready") return;
    const t = setInterval(async () => {
      const localStr = JSON.stringify(metaRef.current || null);
      if (metaRef.current && localStr !== lastSaved.current) return; // edição local ainda não salva: nunca sobrescrever
      const remote = await sGet(META_KEY, false);
      if (!remote) return;
      const rs = JSON.stringify(remote);
      if (rs !== localStr && rs !== lastSaved.current) {
        const merged = metaRef.current ? mergeMeta(metaRef.current, remote) : remote;
        metaRef.current = merged;
        lastSaved.current = JSON.stringify(merged);
        setMetaRaw(merged);
        sSet(META_KEY, merged, false);
      }
    }, 15000);
    return () => clearInterval(t);
  }, [phase]);

  const refreshNow = async () => {
    setSyncing(true);
    const remote = await sGet(META_KEY, false);
    if (remote) { metaRef.current = remote; lastSaved.current = JSON.stringify(remote); setMetaRaw(remote); }
    setSyncing(false);
  };

  /* ---------- agenda do Outlook ---------- */
  const [agenda, setAgenda] = useState({ fetchedAt: 0, events: [] });
  const [agendaLoading, setAgendaLoading] = useState(false);
  const [agendaErr, setAgendaErr] = useState(null);
  const agendaLoadingRef = useRef(false);

  const fetchAgenda = async (force) => {
    if (agendaLoadingRef.current) return;
    if (!force && Date.now() - agenda.fetchedAt < 15 * 60 * 1000 && agenda.events.length) return;
    agendaLoadingRef.current = true;
    setAgendaLoading(true); setAgendaErr(null);
    try {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(end.getDate() + 31);
      const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T00:00:00`;
      const teamEmails = (metaRef.current?.users || []).map((u) => (u.email || "").toLowerCase()).filter(Boolean);
      const eqPart = teamEmails.length
        ? ` Lista de e-mails da equipe: ${teamEmails.join(", ")}. Adicione a cada evento o campo "eq": array com os e-mails DESSA lista que estiverem entre os participantes do evento (vazio se nenhum).`
        : "";
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 4000,
          messages: [{
            role: "user",
            content: `Use a ferramenta outlook_calendar_search com query "*", afterDateTime "${iso(start)}", beforeDateTime "${iso(end)}", order "oldest", limit 15. Não escreva nenhum texto. Sua resposta final deve ser APENAS este JSON compacto em uma linha, sem markdown: {"e":[{"t":"título com no máximo 60 caracteres","i":"YYYY-MM-DDTHH:MM","f":"YYYY-MM-DDTHH:MM","o":"primeiro nome do organizador","m":1,"eq":[]}]} onde m é 1 se eu sou o organizador, senão 0.${eqPart} Use os dateTime de start/end exatamente como retornados. Sem eventos: {"e":[]}.`,
          }],
          mcp_servers: [{ type: "url", url: "https://microsoft365.mcp.claude.com/mcp", name: "microsoft-365" }],
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || "erro na API");
      const text = (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
      const jm = text.match(/\{[\s\S]*/);
      if (!jm) throw new Error("agenda retornou vazia — tente atualizar");
      let rawList = [];
      try {
        const parsed = JSON.parse(jm[0].match(/\{[\s\S]*\}/)[0]);
        rawList = parsed.e || parsed.eventos || [];
      } catch (err) {
        // resposta truncada: resgata os eventos completos
        const items = jm[0].match(/\{"t":[\s\S]*?\}(?=\s*[,\]])/g) || [];
        items.forEach((s) => { try { rawList.push(JSON.parse(s)); } catch (e2) {} });
        if (!rawList.length) throw new Error("resposta truncada — tente atualizar");
      }
      const events = rawList.map((x) => x.titulo
        ? x
        : { titulo: x.t, inicio: x.i, fim: x.f, organizador: x.o || "", souOrganizador: !!x.m, local: "", eq: (x.eq || []).map((e) => String(e).toLowerCase()) });
      const next = { fetchedAt: Date.now(), events };
      setAgenda(next);
      sSet("agenda-cache", next, false);
    } catch (e) {
      setAgendaErr(`Não consegui acessar sua agenda (${(e && e.message) || "erro desconhecido"}). Verifique se o conector Microsoft 365 está ativo nas configurações do Claude e toque em atualizar.`);
    }
    agendaLoadingRef.current = false;
    setAgendaLoading(false);
  };

  useEffect(() => {
    if (phase !== "ready") return;
    (async () => {
      const cache = await sGet("agenda-cache", false);
      if (cache && cache.events) setAgenda(cache);
      fetchAgenda(false);
    })();
  }, [phase]); // eslint-disable-line

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

  /* ---------- roteamento !subtema ---------- */
  const routeLines = async () => {
    const b = body;
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
      const tb = (await loadBody(pg.id)) || { content: "", transcript: "", structured: null };
      const nb2 = { ...tb, content: (tb.content ? tb.content + "\n" : "") + g.lines.join("\n") };
      bodyCache.current[pg.id] = nb2;
      await sSet(noteKey(pg.id), nb2, false);
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

  const [scanning, setScanning] = useState(false);
  const scanAllTasks = async () => {
    const m = metaRef.current;
    if (!m || scanning) return;
    setScanning(true);
    try {
      let tasks = m.tasks || [];
      for (const nb of m.notebooks) {
        for (const s of nb.sections) {
          for (const n of s.notes) {
            if (tasks.filter((t) => t.noteId === n.id).some((t) => t.origin === "ia")) continue;
            const b = n.id === noteId && body ? body : await loadBody(n.id);
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

  /* ---------- abrir/salvar corpo da ata ---------- */
  useEffect(() => {
    if (!noteId) { setBody(null); return; }
    let alive = true;
    (async () => {
      const b = await loadBody(noteId);
      if (alive) setBody(b || { content: "", transcript: "", structured: null });
    })();
    return () => { alive = false; };
  }, [noteId]);

  const [saveState, setSaveState] = useState(null); // 'saving' | 'saved'
  const dirtyBodyRef = useRef(null);
  const patchBody = (patch) => {
    setBody((b) => {
      const p = typeof patch === "function" ? patch(b) : patch;
      const next = { ...b, ...p };
      bodyCache.current[noteId] = next;
      dirtyBodyRef.current = { id: noteId };
      setSaveState("saving");
      clearTimeout(bodyTimer.current);
      bodyTimer.current = setTimeout(async () => {
        await sSet(noteKey(noteId), next, false);
        if (dirtyBodyRef.current && dirtyBodyRef.current.id === noteId) dirtyBodyRef.current = null;
        setSaveState("saved");
      }, 700);
      return next;
    });
  };

  const flushSaves = () => {
    try {
      if (metaRef.current) {
        const ls = JSON.stringify(metaRef.current);
        if (ls !== lastSaved.current) {
          clearTimeout(metaTimer.current);
          lastSaved.current = ls;
          sSet(META_KEY, metaRef.current, false);
        }
      }
      if (dirtyBodyRef.current) {
        const { id } = dirtyBodyRef.current;
        clearTimeout(bodyTimer.current);
        const b = bodyCache.current[id];
        if (b) sSet(noteKey(id), b, false);
        dirtyBodyRef.current = null;
      }
    } catch (e) {}
  };

  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "hidden") flushSaves(); };
    window.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", flushSaves);
    window.addEventListener("beforeunload", flushSaves);
    return () => {
      window.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", flushSaves);
      window.removeEventListener("beforeunload", flushSaves);
    };
  }, []); // eslint-disable-line

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
    sSet(noteKey(n.id), { content: "", transcript: "", structured: null }, false);
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
    sDel(noteKey(id), false); sDel(noteKey(id), true);
    setMeta((m) => ({ ...m, trash: (m.trash || []).filter((t) => t.id !== id) }));
  };

  const emptyTrash = () => {
    (metaRef.current?.trash || []).forEach((t) => sDel(noteKey(t.id), false));
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

  const plusDaysBR = (dateStr, n) => {
    let d;
    const m2 = (dateStr || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m2) d = new Date(+m2[3], +m2[2] - 1, +m2[1]);
    else d = new Date();
    d.setDate(d.getDate() + n);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  };

  const editTask = async (taskId, patch) => {
    const m = metaRef.current;
    const t = (m.tasks || []).find((x) => x.id === taskId);
    if (!t) return;
    const newUser = patch.userId ? m.users.find((u) => u.id === patch.userId) : null;
    if (t.noteId && t.origin !== "ia") {
      const b = await loadBody(t.noteId);
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
        const fields = [];
        if (typeof b.content === "string") fields.push({ get: () => b.content, set: (v) => { b.content = v; } });
        (b.blocks || []).forEach((bl) => {
          if (typeof bl.text === "string") fields.push({ get: () => bl.text, set: (v) => { bl.text = v; } });
          if (typeof bl.comment === "string") fields.push({ get: () => bl.comment, set: (v) => { bl.comment = v; } });
        });
        for (const f of fields) {
          const lines = f.get().split("\n");
          const idx = lines.findIndex((ln) => oldUser && ln.toLowerCase().includes(("@" + oldUser.name).toLowerCase()) && stripLine(ln) === t.text);
          if (idx >= 0) {
            lines[idx] = rewrite(lines[idx]);
            f.set(lines.join("\n"));
            const nb2 = { ...b };
            bodyCache.current[t.noteId] = nb2;
            await sSet(noteKey(t.noteId), nb2, false);
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

  /* ---------- envio automático do relatório (CallMeBot) ---------- */
  const updateUser = (id, patch) => {
    setMeta((m) => ({
      ...m,
      users: m.users.map((u) => (u.id === id ? { ...u, ...patch } : u)),
      tasks: patch.name
        ? (m.tasks || []).map((t) => (t.userId === id ? { ...t, userName: patch.name } : t))
        : m.tasks,
    }));
  };

  const waReady = (u) => !!u.phone && !!tmbKey;

  const [sendList, setSendList] = useState(null); // [{id,name,url,done}] | null

  const sendReportToTeam = async () => {
    await scanAllTasks();
    const m = metaRef.current;
    const tasksAll = m.tasks || [];
    const targets = m.users.filter((u) => waReady(u));
    if (!targets.length) return 0;
    const list = targets.map((u) => {
      const txt = reportForUser(u, tasksAll, u.id === me?.id).slice(0, 1500);
      return {
        id: u.id, name: u.name, done: false,
        url: `https://api.textmebot.com/send.php?recipient=%2B${encodeURIComponent(u.phone)}&apikey=${encodeURIComponent(tmbKey)}&text=${encodeURIComponent(txt)}`,
      };
    });
    setSendList(list);
    setMeta((mm) => ({ ...mm, autoSend: isoToday() }));
    return list.length;
  };

  const markSent = (id) => setSendList((l) => l && l.map((x) => (x.id === id ? { ...x, done: true } : x)));

  const [pendingAuto, setPendingAuto] = useState(false);
  useEffect(() => {
    if (phase !== "ready" || !meta) { setPendingAuto(false); return; }
    if (new Date().getHours() < 7) { setPendingAuto(false); return; }
    if ((meta.autoSend || "") === isoToday()) { setPendingAuto(false); return; }
    setPendingAuto((meta.users || []).length > 0);
  }, [phase, meta]); // eslint-disable-line

  const reportForUser = (u, tasksAll, withMeetings) => {
    const tKey = dateKeyBR(todayBR());
    const due = (t) => !t.done && (!t.date || dateKeyBR(t.date) <= tKey);
    const fmt = (t) => `• ${t.important ? "⭐ " : ""}${t.text} ${t.date ? `(${t.date})` : "(sem prazo)"}${t.date && dateKeyBR(t.date) < tKey ? " ⚠️" : ""}`;
    const list = tasksAll.filter((t) => t.userId === u.id && due(t))
      .sort((a, b) => (dateKeyBR(a.date) || "99999999").localeCompare(dateKeyBR(b.date) || "99999999"));
    let txt = `*📋 BOM DIA, ${u.name.split(" ")[0]}! — ${todayBR()}*\n`;
    const localDay = isoToday();
    if (withMeetings) {
      const ms = (agenda.events || []).filter((e) => e.inicio.slice(0, 10) === localDay).sort((a, b) => a.inicio.localeCompare(b.inicio));
      txt += `\n*🗓 Reuniões (${ms.length})*\n` + (ms.length ? ms.map((e) => `• ${e.inicio.slice(11, 16)}–${e.fim.slice(11, 16)} ${e.titulo}`).join("\n") : "• sem reuniões") + "\n";
    } else if (u.email) {
      const mine2 = (agenda.events || []).filter((e) =>
        e.inicio.slice(0, 10) === localDay && (e.eq || []).includes(u.email.toLowerCase())
      ).sort((a, b) => a.inicio.localeCompare(b.inicio));
      if (mine2.length) {
        txt += `\n*🤝 Reuniões hoje com ${me?.name ? me.name.split(" ")[0] : "o gestor"} (${mine2.length})*\n` +
          mine2.map((e) => `• ${e.inicio.slice(11, 16)}–${e.fim.slice(11, 16)} ${e.titulo}`).join("\n") + "\n";
      }
    }
    txt += `\n*✅ Suas pendências (${list.length})*\n`;
    txt += list.length ? list.map(fmt).join("\n") : "• você está em dia 👏";
    if (withMeetings) {
      const others = tasksAll.filter((t) => t.userId && t.userId !== u.id && due(t))
        .sort((a, b) => (dateKeyBR(a.date) || "99999999").localeCompare(dateKeyBR(b.date) || "99999999"));
      txt += `\n\n*👥 Pendências da equipe (${others.length})*\n`;
      if (others.length) {
        const by = {};
        others.forEach((t) => { (by[t.userName] = by[t.userName] || []).push(t); });
        txt += Object.keys(by).map((name) => `_${name}_\n` + by[name].map(fmt).join("\n")).join("\n");
      } else {
        txt += "• equipe em dia";
      }
    }
    txt += `\n\n_Planner - Gui - Finamob_`;
    return txt;
  };

  const [prevBlocks, setPrevBlocks] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      setPrevBlocks(null);
      if (!noteMeta || !noteMeta.templateId) return;
      const p = prevOfTemplate(noteMeta);
      if (!p) return;
      const pb = await loadBody(p.id);
      if (alive && pb && pb.blocks) setPrevBlocks(pb.blocks);
    })();
    return () => { alive = false; };
  }, [noteId, phase, meta && meta.notebooks]); // eslint-disable-line

  useEffect(() => {
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setView("search");
        setShowSide(false);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []); // eslint-disable-line

  /* ---------- exportar / importar dados ---------- */
  const [xfer, setXfer] = useState(null); // {mode:'export',text} | {mode:'import',text,err?}

  const exportAll = async () => {
    setXfer({ mode: "export", text: "", loading: true });
    const m = metaRef.current;
    const bodies = {};
    for (const nb of m.notebooks) for (const s of nb.sections) for (const n of s.notes) {
      const b = await loadBody(n.id);
      if (b) bodies[n.id] = b;
    }
    for (const t of m.trash || []) {
      const b = await loadBody(t.id);
      if (b) bodies[t.id] = b;
    }
    const payload = { app: "Planner - Gui - Finamob", exportadoEm: new Date().toISOString(), meta: m, bodies, tmbKey };
    setXfer({ mode: "export", text: JSON.stringify(payload) });
  };

  const [autoRestoring, setAutoRestoring] = useState(false);
  const autoTriedRef = useRef(false);
  const restoreCancelRef = useRef(false);

  const restoreFromCloud = async (silent) => {
    if (!silent) setXfer({ mode: "import", text: "", loading: true });
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 32000,
          messages: [{ role: "user", content: `Localize no meu OneDrive (pasta raiz do drive do usuário) o arquivo "planner-backup-completo.json" e responda APENAS com o conteúdo bruto e completo do arquivo, sem nenhum texto antes ou depois, sem markdown.` }],
          mcp_servers: [{ type: "url", url: "https://microsoft365.mcp.claude.com/mcp", name: "microsoft-365" }],
        }),
      });
      const data = await res.json();
      const text = (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
      const jm = text.match(/\{[\s\S]*\}/);
      if (!jm) throw new Error("sem json");
      if (restoreCancelRef.current) return;
      await importAll(jm[0]);
    } catch (e) {
      if (silent) { setAutoRestoring(false); return; }
      setXfer({ mode: "import", text: "", err: "Não consegui ler o backup automaticamente — abra o arquivo no OneDrive, copie o conteúdo e cole aqui." });
    }
  };

  // Instância nova? Restaura sozinho do backup OneDrive, sem cliques.
  useEffect(() => {
    if (phase !== "ready" || !meta || autoTriedRef.current) return;
    const fresh = (meta.users || []).length <= 1;
    if (!fresh) return;
    autoTriedRef.current = true;
    restoreCancelRef.current = false;
    setAutoRestoring(true);
    setTimeout(() => restoreFromCloud(true), 1200);
  }, [phase, meta]); // eslint-disable-line

  const importAll = async (text) => {
    try {
      const p = JSON.parse(text);
      if (!p.meta || !p.meta.notebooks) throw new Error("formato");
      await sSet(META_KEY, p.meta, false);
      for (const id of Object.keys(p.bodies || {})) {
        await sSet(noteKey(id), p.bodies[id], false);
      }
      if (p.tmbKey) await sSet("tmb-key-v1", p.tmbKey, false);
      window.location.reload();
    } catch (e) {
      setXfer((x) => ({ ...x, err: "JSON inválido — copie o texto completo da exportação e cole aqui." }));
    }
  };

  /* ---------- espelho no OneDrive (para a automação das 7h) ---------- */
  const [cloudAt, setCloudAt] = useState(null);
  const cloudLastRef = useRef(0);

  const syncToOneDrive = async (force) => {
    const now = Date.now();
    if (!force && now - cloudLastRef.current < 10 * 60 * 1000) return;
    cloudLastRef.current = now;
    const m = metaRef.current;
    if (!m) return;
    const payload = {
      app: "Planner - Gui - Finamob",
      atualizadoEm: new Date().toISOString(),
      gestor: me?.name || "",
      chaveTextMeBot: tmbKey || "",
      equipe: (m.users || []).map((u) => ({ nome: u.name, area: u.area, telefone: u.phone || "", email: u.email || "" })),
      tarefasAbertas: (m.tasks || []).filter((t) => !t.done).map((t) => ({
        tarefa: t.text, responsavel: t.userName || null, prazo: t.date || null,
        importante: !!t.important, origem: `${t.nbName} · ${t.noteTitle}`,
      })),
    };
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `Salve no MEU OneDrive (drive do usuário logado, pasta raiz) um arquivo chamado "planner-gui-finamob.json" com EXATAMENTE este conteúdo:\n${JSON.stringify(payload)}\nSe o arquivo já existir, substitua o conteúdo (sharepoint_update_file); se não existir, crie (sharepoint_upload_file). Ao final responda apenas com a palavra: ok`,
          }],
          mcp_servers: [{ type: "url", url: "https://microsoft365.mcp.claude.com/mcp", name: "microsoft-365" }],
        }),
      });
      const data = await res.json();
      const text = (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
      if (/ok/i.test(text)) setCloudAt(new Date());
    } catch (e) { /* sem conector M365 neste usuário: segue sem espelho */ }
  };

  useEffect(() => {
    if (phase !== "ready") return;
    const t = setTimeout(() => syncToOneDrive(false), 8000);
    return () => clearTimeout(t);
  }, [phase]); // eslint-disable-line

  useEffect(() => {
    if (phase !== "ready" || !meta) return;
    const t = setTimeout(() => syncToOneDrive(false), 120000);
    return () => clearTimeout(t);
  }, [meta && (meta.tasks || []).length, meta && (meta.users || []).length]); // eslint-disable-line

  /* ---------- backup completo diário no OneDrive ---------- */
  const backupToOneDrive = async () => {
    try {
      const last = await sGet("backup-date-v1", false);
      const today = isoToday();
      if (last === today) return;
      const m = metaRef.current;
      if (!m) return;
      const bodies = {};
      for (const nb of m.notebooks) {
        for (const s of nb.sections) {
          for (const n of s.notes.slice(0, 150)) {
            const b = await loadBody(n.id);
            if (b) bodies[n.id] = { ...b, content: (b.content || "").slice(0, 6000), transcript: "" };
          }
        }
      }
      const payload = { app: "Planner - Gui - Finamob", backupEm: new Date().toISOString(), meta: m, bodies, tmbKey };
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 1000,
          messages: [{ role: "user", content: `Salve no MEU OneDrive (drive do usuário, pasta raiz) o arquivo "planner-backup-completo.json" substituindo se existir, com EXATAMENTE este conteúdo:\n${JSON.stringify(payload)}\nAo final responda apenas: ok` }],
          mcp_servers: [{ type: "url", url: "https://microsoft365.mcp.claude.com/mcp", name: "microsoft-365" }],
        }),
      });
      const data = await res.json();
      const text = (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
      if (/ok/i.test(text)) sSet("backup-date-v1", today, false);
    } catch (e) { /* tenta de novo amanhã */ }
  };

  useEffect(() => {
    if (phase !== "ready") return;
    const t = setTimeout(() => backupToOneDrive(), 25000);
    return () => clearTimeout(t);
  }, [phase]); // eslint-disable-line

  /* ---------- resumo semanal por IA ---------- */
  const [weekly, setWeekly] = useState(null);
  const weeklySummary = async () => {
    setWeekly({ loading: true });
    try {
      const m = metaRef.current;
      const cut = new Date(); cut.setDate(cut.getDate() - 7);
      const cutKey = dateKeyBR(`${String(cut.getDate()).padStart(2, "0")}/${String(cut.getMonth() + 1).padStart(2, "0")}/${cut.getFullYear()}`);
      const pages = [];
      for (const nb of m.notebooks) for (const s of nb.sections) for (const n of s.notes) {
        if (dateKeyBR(n.createdAt) >= cutKey) {
          const b = await loadBody(n.id);
          pages.push(`[${nb.name} · ${s.name}] ${n.title}: ${((b && b.structured && b.structured.resumo) || bodyText(b)).slice(0, 600)}`);
        }
      }
      const done = (m.tasks || []).filter((t) => t.done).map((t) => `${t.text} (${t.userName || "?"})`);
      const open = (m.tasks || []).filter((t) => !t.done).map((t) => `${t.text} (${t.userName || "?"}, ${t.date || "sem prazo"})`);
      const prompt = `Você é o assistente do Planner - Gui - Finamob. Hoje é ${todayBR()}. Monte um RESUMO SEMANAL executivo em português, formatado para WhatsApp (use *negrito* e •), com: principais assuntos e decisões da semana, tarefas concluídas, tarefas em aberto/atrasadas por pessoa, e 2-3 recomendações de foco para a próxima semana. Máximo ~1500 caracteres.\n\nPÁGINAS DA SEMANA:\n${pages.join("\n").slice(0, 12000) || "(nenhuma)"}\n\nCONCLUÍDAS: ${done.join("; ") || "(nenhuma)"}\nEM ABERTO: ${open.join("; ") || "(nenhuma)"}`;
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
      });
      const data = await res.json();
      const text = (data.content || []).map((c) => c.text || "").join("");
      setWeekly({ text: text.trim() || "Não consegui montar o resumo." });
    } catch (e) {
      setWeekly({ text: "Erro ao gerar o resumo — tente novamente." });
    }
  };

  /* ---------- mover páginas ---------- */
  const [moveId, setMoveId] = useState(null);
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

  /* ---------- templates de atas semanais ---------- */
  const [showTpl, setShowTpl] = useState(false);
  const [tplDate, setTplDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  const prevOfTemplate = (nm) => {
    if (!nm || !nm.templateId || !meta) return null;
    let prev = null;
    meta.notebooks.forEach((nb) => nb.sections.forEach((s) => s.notes.forEach((n) => {
      if (n.templateId === nm.templateId && n.id !== nm.id && dateKeyBR(n.createdAt) <= dateKeyBR(nm.createdAt)) {
        if (!prev || dateKeyBR(n.createdAt) > dateKeyBR(prev.createdAt)) prev = n;
      }
    })));
    return prev;
  };

  const createFromTemplate = async (tpl, dateBR) => {
    const when = dateBR || todayBR();
    let prev = null;
    meta.notebooks.forEach((nb) => nb.sections.forEach((s) => s.notes.forEach((n) => {
      if (n.templateId === tpl.id && dateKeyBR(n.createdAt) < dateKeyBR(when)) {
        if (!prev || dateKeyBR(n.createdAt) > dateKeyBR(prev.createdAt)) prev = n;
      }
    })));
    let content = tpl.skeleton || "";
    let blocks = tpl.v === 2 ? JSON.parse(JSON.stringify(tpl.blocksDef || [])) : null;
    let participants = "";
    if (prev) {
      const pb = await loadBody(prev.id);
      if (tpl.v === 2 && pb && pb.blocks) blocks = JSON.parse(JSON.stringify(pb.blocks));
      else if (pb && pb.content) content = pb.content;
      participants = prev.participants || "";
    }
    const n = { id: uid(), title: `${tpl.name} — ${when}`, createdAt: when, concluded: false, templateId: tpl.id, participants, author: me?.name || "" };
    setMeta((m) => ({
      ...m,
      notebooks: m.notebooks.map((nb) => nb.id !== notebook.id ? nb : {
        ...nb,
        sections: nb.sections.map((s) => (s.id !== section.id ? s : { ...s, notes: [n, ...s.notes] })),
      }),
    }));
    const bodyNew = { content: blocks ? "" : content, transcript: "", structured: null, blocks: blocks || undefined };
    bodyCache.current[n.id] = bodyNew;
    sSet(noteKey(n.id), bodyNew, false);
    setNoteId(n.id); setView("editor"); setShowTpl(false); setShowSide(false);
  };

  const addTemplate = (name, skeleton) =>
    setMeta((m) => ({ ...m, templates: [...(m.templates || []), { id: uid(), name, skeleton }] }));
  const removeTemplate = (id) =>
    setMeta((m) => ({ ...m, templates: (m.templates || []).filter((t) => t.id !== id) }));

  /* ---------- concluir ata (IA) ---------- */
  const concludeAta = async () => {
    if (!noteMeta || !body) return;
    setStructuring(true); setError(null);
    const userList = meta.users.map((u) => `${u.name} (${u.area})`).join(", ") || "(nenhum)";
    const partInfo = noteMeta.participants ? `Participantes informados pelo usuário (use exatamente estes na lista de participantes): ${noteMeta.participants}.` : "Participantes não informados: deduza das anotações/transcrição.";
    const prompt = `Você estrutura atas de reunião de uma empresa brasileira. Data de hoje: ${todayBR()}.
Usuários cadastrados: ${userList}.
${partInfo}

ANOTAÇÕES LIVRES DA REUNIÃO:
${bodyText(body) || "(vazio)"}

TRANSCRIÇÃO DO ÁUDIO DA REUNIÃO (pode estar vazia; se houver, use-a para complementar a ata com pontos que não estão nas anotações):
${body.transcript || "(sem transcrição)"}

Gere a ata padrão. Responda SOMENTE com JSON válido, sem markdown, sem texto antes ou depois, neste formato exato:
{"titulo":"...","data":"DD/MM/AAAA","resumo":"parágrafo curto resumindo a reunião","participantes":["..."],"pauta":["..."],"decisoes":["..."],"acoes":[{"tarefa":"...","responsavel":"nome exato de usuário cadastrado ou null","prazo":"DD/MM/AAAA ou null","importante":true}]}
Regras: preserve as tarefas marcadas com @ e as datas marcadas com 📅; linhas com asterisco (*) são tarefas importantes (importante:true, e remova o asterisco do texto); demais ações têm importante:false; atribua responsavel apenas se corresponder a um usuário cadastrado; se a transcrição trouxer decisões ou ações novas, inclua-as.`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const out = await res.json();
      const text = (out.content || []).map((c) => c.text || "").join("");
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const newTasks = (parsed.acoes || [])
        .map((a) => ({ a, u: meta.users.find((x) => x.name === a.responsavel) || null }))
        .filter(({ u }) => !!u) // só vira tarefa se houver responsável delegado
        .map(({ a, u }) => ({
          id: uid(), noteId, noteTitle: parsed.titulo || noteMeta.title, nbName: notebook.name,
          text: a.tarefa, userId: u.id, userName: u.name,
          date: a.prazo || null, done: false, important: !!a.importante, origin: "ia",
        }));
      const nextBody = { ...body, structured: parsed };
      setBody(nextBody);
      bodyCache.current[noteId] = nextBody;
      sSet(noteKey(noteId), nextBody, false);
      setTimeout(() => flushSaves(), 150);
      setMeta((m) => ({
        ...m,
        tasks: [...(m.tasks || []).filter((t) => t.noteId !== noteId), ...newTasks],
        notebooks: m.notebooks.map((nb) => nb.id !== notebook.id ? nb : {
          ...nb,
          sections: nb.sections.map((s) => s.id !== section.id ? s : {
            ...s,
            notes: s.notes.map((n) => n.id !== noteId ? n : { ...n, concluded: true, title: parsed.titulo || n.title }),
          }),
        }),
      }));
    } catch (e) {
      setError("Não consegui estruturar a ata. Verifique a conexão e tente novamente.");
    }
    setStructuring(false);
  };

  /* ---------------------------------------------------------------- */
  if (phase === "loading" || !meta) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: C.appBg }}>
        <Loader2 className="animate-spin" color={C.ink} />
      </div>
    );
  }

  if (phase === "identify") {
    return (
      <IdentifyScreen
        users={meta.users}
        onPick={async (u) => {
          await sSet("livro-me-v1", u.id, false);
          setMe(u); setPhase("ready");
        }}
        onCreate={async (name, area) => {
          const u = addUser(name, area);
          await sSet("livro-me-v1", u.id, false);
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
        <button onClick={refreshNow} className="p-2 rounded-lg text-white" style={{ background: C.inkSoft }} title="Sincronizar">
          <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
        </button>
        <button onClick={() => {
          const opening = view !== "meetings";
          setView(opening ? "meetings" : "editor");
          if (opening) fetchAgenda(false);
        }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
          style={{ background: view === "meetings" ? C.stamp : C.inkSoft, color: "#fff" }}>
          <CalendarDays size={15} /> <span className="hidden md:inline">Reuniões</span>
        </button>
        <button onClick={() => {
          const opening = view !== "report";
          setView(opening ? "report" : "editor");
          if (opening) { fetchAgenda(false); scanAllTasks(); }
        }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
          style={{ background: view === "report" ? C.stamp : C.inkSoft, color: "#fff" }}>
          <ClipboardList size={15} /> <span className="hidden md:inline">Meu dia</span>
        </button>
        <button onClick={() => { setView(view === "search" ? "editor" : "search"); setShowSide(false); }}
          className="p-2 rounded-lg text-white" style={{ background: view === "search" ? C.stamp : C.inkSoft }} title="Busca e IA">
          <SearchIcon size={15} />
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

      {autoRestoring && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(20,26,38,.65)" }}>
          <div className="rounded-2xl p-6 max-w-sm w-full text-center" style={{ background: "#fff" }}>
            <Loader2 size={28} className="animate-spin mx-auto mb-3" color={C.stamp} />
            <p className="font-semibold mb-1" style={{ color: "#1F2937" }}>Instância nova detectada</p>
            <p className="text-sm mb-4" style={{ color: "#6B7280" }}>Restaurando seus dados do backup OneDrive… (equipe, páginas, FUPs e tarefas)</p>
            <button onClick={() => { restoreCancelRef.current = true; setAutoRestoring(false); }}
              className="text-xs underline" style={{ color: "#9CA3AF" }}>
              cancelar (começar do zero)
            </button>
          </div>
        </div>
      )}
      {meta && (meta.users || []).length <= 1 && !sendList && !autoRestoring && (
        <button
          onClick={() => { setXfer({ mode: "import", text: "" }); }}
          className="w-full text-left px-4 py-2 text-xs font-medium flex items-center gap-2 shrink-0"
          style={{ background: "#E7EFF9", color: "#1F5FA8" }}>
          🔄 Endereço novo do app? Toque aqui para restaurar seus dados do backup OneDrive
        </button>
      )}
      {pendingAuto && (() => {
        const meUser = meta.users.find((x) => x.id === me?.id) || { id: me?.id, name: me?.name || "Gestor" };
        const txt = reportForUser(meUser, meta.tasks || [], true).slice(0, 1800);
        return (
          <a
            href={"https://wa.me/?text=" + encodeURIComponent(txt)}
            target="_blank" rel="noreferrer"
            onClick={() => { setPendingAuto(false); setMeta((m) => ({ ...m, autoSend: isoToday() })); }}
            className="w-full text-left px-4 py-2.5 text-sm font-medium flex items-center gap-2 shrink-0 no-underline"
            style={{ background: "#FBEEDB", color: "#854F0B" }}>
            <Send size={14} /> Relatório diário pronto — toque para abrir o WhatsApp e enviar ao grupo da equipe
          </a>
        );
      })()}

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
            <div className="flex items-center gap-1">
              <button onClick={() => setShowTpl(true)} className="p-1 rounded-md" style={{ background: "#E2E5E9", color: "#374151" }} title="Nova página de modelo (FUP semanal)">
                <FileText size={14} />
              </button>
              <button onClick={addNote} className="p-1 rounded-md" style={{ background: C.stamp, color: "#fff" }}><Plus size={14} /></button>
            </div>
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
          ) : view === "search" ? (
            <SearchView meta={meta} loadBody={loadBody} onGo={(id) => { goToNote(id); }} />
          ) : view === "meetings" ? (
            <MeetingsView agenda={agenda} loading={agendaLoading} err={agendaErr} onRefresh={() => fetchAgenda(true)} />
          ) : view === "report" ? (
            <ReportView agenda={agenda} meta={meta} me={me} loading={agendaLoading || scanning}
              onToggle={toggleTask} onGo={goToNote} onRefresh={() => { fetchAgenda(true); scanAllTasks(); }}
              onSendAll={sendReportToTeam} sendList={sendList} onMarkSent={markSent} onCloseSend={() => setSendList(null)}
              cloudAt={cloudAt} tmbKey={tmbKey} onWeekly={weeklySummary} weekly={weekly} onCloseWeekly={() => setWeekly(null)} />
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
          ) : noteMeta.concluded && body.structured ? (
            <AtaDocument body={body} tasks={(meta.tasks || []).filter((t) => t.noteId === noteId)} meta={meta}
              prevBlocks={prevBlocks}
              onReopen={() => patchNoteMeta({ concluded: false })} />
          ) : (
            <Editor
              noteMeta={noteMeta} body={body} users={meta.users}
              sections={allSections.filter((s) => s.secId !== secId)}
              prevBlocks={prevBlocks}
              tplInfo={noteMeta.templateId ? {
                name: ((meta.templates || []).find((t) => t.id === noteMeta.templateId) || {}).name || "Modelo",
                prevDate: (prevOfTemplate(noteMeta) || {}).createdAt || null,
              } : null}
              tplSiblings={(() => {
                if (!noteMeta.templateId) return null;
                const sib = [];
                meta.notebooks.forEach((nb) => nb.sections.forEach((s) => s.notes.forEach((n) => {
                  if (n.templateId === noteMeta.templateId) sib.push({ id: n.id, date: n.createdAt });
                })));
                sib.sort((a, b) => dateKeyBR(a.date).localeCompare(dateKeyBR(b.date)));
                return sib.length > 1 ? sib : null;
              })()}
              onGoNote={goToNote}
              onSaveTemplate={() => addTemplate(noteMeta.title || "Modelo sem nome", body.content || "")}
              onTitle={(t) => patchNoteMeta({ title: t })} onMeta={patchNoteMeta} saveState={saveState}
              onBody={patchBody}
              onConclude={concludeAta}
              structuring={structuring}
              error={error}
            />
          )}
        </main>
      </div>

      {xfer && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(20,26,38,.55)" }} onClick={() => setXfer(null)}>
          <div className="w-full max-w-lg rounded-2xl p-5 max-h-full overflow-y-auto" style={{ background: "#fff" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold" style={{ color: "#1F2937" }}>{xfer.mode === "export" ? "Exportar dados" : "Importar dados"}</h2>
              <button onClick={() => setXfer(null)}><X size={18} /></button>
            </div>
            {xfer.mode === "export" ? (
              xfer.loading ? (
                <p className="text-sm flex items-center gap-2 py-4" style={{ color: "#6B7280" }}><Loader2 size={14} className="animate-spin" /> Empacotando cadernos, páginas e tarefas…</p>
              ) : (
                <>
                  <p className="text-xs mb-2" style={{ color: "#6B7280" }}>
                    Copie o pacote abaixo e cole em "Importar dados" na outra instância do app (ex.: a versão publicada/instalada). Tudo vai junto: cadernos, páginas, atas, tarefas, equipe, modelos e chave.
                  </p>
                  <textarea readOnly value={xfer.text} onFocus={(e) => e.target.select()}
                    className="w-full h-32 border rounded-lg p-2 text-xs outline-none mb-2" style={{ borderColor: C.line, fontFamily: "monospace" }} />
                  <button
                    onClick={() => {
                      const ta = document.createElement("textarea"); ta.value = xfer.text;
                      document.body.appendChild(ta); ta.select();
                      try { document.execCommand("copy"); } catch (e) {}
                      document.body.removeChild(ta);
                    }}
                    className="w-full rounded-lg py-2 text-sm font-medium text-white" style={{ background: C.stamp }}>
                    Copiar pacote
                  </button>
                </>
              )
            ) : (
              <>
                <p className="text-xs mb-2" style={{ color: "#6B7280" }}>
                  Cole aqui o pacote copiado da exportação. <b>Atenção:</b> os dados desta instância serão substituídos pelos importados. Dica: o backup diário "planner-backup-completo.json" no seu OneDrive usa este mesmo formato — para restaurar, abra o arquivo lá, copie o conteúdo e cole aqui.
                </p>
                <button onClick={restoreFromCloud} disabled={xfer.loading}
                  className="w-full rounded-lg py-2 text-sm font-medium text-white mb-2 flex items-center justify-center gap-2"
                  style={{ background: "#1F5FA8", opacity: xfer.loading ? 0.7 : 1 }}>
                  {xfer.loading ? <><Loader2 size={14} className="animate-spin" /> Lendo o backup no OneDrive…</> : "🔄 Restaurar automaticamente do backup OneDrive"}
                </button>
                <p className="text-center text-xs mb-2" style={{ color: "#9CA3AF" }}>— ou cole o pacote manualmente —</p>
                <textarea value={xfer.text} onChange={(e) => setXfer({ ...xfer, text: e.target.value })}
                  placeholder='{"app":"Planner - Gui - Finamob", ...}'
                  className="w-full h-32 border rounded-lg p-2 text-xs outline-none mb-2" style={{ borderColor: C.line, fontFamily: "monospace" }} />
                {xfer.err && <p className="text-xs mb-2" style={{ color: C.danger }}>{xfer.err}</p>}
                <button onClick={() => importAll(xfer.text)}
                  className="w-full rounded-lg py-2 text-sm font-medium text-white" style={{ background: C.stamp }}>
                  Importar e recarregar
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showTpl && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-4" style={{ background: "rgba(20,26,38,.5)" }} onClick={() => setShowTpl(false)}>
          <div className="w-full max-w-sm rounded-2xl p-5 max-h-full overflow-y-auto" style={{ background: "#fff" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold" style={{ color: "#1F2937" }}>Modelos de ata semanal</h2>
              <button onClick={() => setShowTpl(false)}><X size={18} /></button>
            </div>
            <p className="text-xs mb-2" style={{ color: "#6B7280" }}>
              A nova página nasce no subtema atual, já preenchida com os dados da semana anterior — você só atualiza. Ao gerar a ata, a IA monta o comparativo entre as semanas automaticamente.
            </p>
            <label className="flex items-center gap-2 text-xs mb-3" style={{ color: "#4B5563" }}>
              Data do FUP:
              <input type="date" value={tplDate} onChange={(e) => setTplDate(e.target.value)}
                className="border rounded-lg px-2 py-1.5 text-xs outline-none" style={{ borderColor: C.line }} />
            </label>
            <div className="flex flex-col gap-1.5 mb-3">
              {(meta.templates || []).map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: C.line }}>
                  <span className="flex-1 text-sm font-medium" style={{ color: "#1F2937" }}>{t.name}</span>
                  <button onClick={() => {
                    const [y, mo, d] = (tplDate || "").split("-");
                    createFromTemplate(t, y ? `${d}/${mo}/${y}` : undefined);
                  }}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium text-white" style={{ background: C.stamp }}>
                    Criar
                  </button>
                  <button onClick={() => removeTemplate(t.id)} style={{ color: C.danger }}><Trash2 size={13} /></button>
                </div>
              ))}
              {(meta.templates || []).length === 0 && <p className="text-xs" style={{ color: "#9CA3AF" }}>Nenhum modelo ainda.</p>}
            </div>
            <p className="text-xs" style={{ color: "#9CA3AF" }}>
              Para criar um modelo novo: monte uma página com a estrutura desejada e toque em <b>"Salvar como modelo"</b> no editor.
            </p>
          </div>
        </div>
      )}

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
          onExport={() => { setShowTeam(false); exportAll(); }}
          onImport={() => { setShowTeam(false); setXfer({ mode: "import", text: "" }); }}
          tmbKey={tmbKey}
          onSaveKey={saveTmbKey}
          onClose={() => setShowTeam(false)}
          onAdd={(name, area) => addUser(name, area)}
          onUpdate={updateUser}
          onRemove={(id) => setMeta((m) => ({ ...m, users: m.users.filter((u) => u.id !== id) }))}
          onSwitch={() => { setShowTeam(false); setPhase("identify"); }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tela de identificação                                               */
/* ------------------------------------------------------------------ */
function IdentifyScreen({ users, onPick, onCreate }) {
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  return (
    <div className="h-screen flex items-center justify-center p-4" style={{ background: C.ink }}>
      <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: "#fff" }}>
        <div className="flex items-center gap-2 mb-1">
          <BookOpen size={20} color={C.stamp} />
          <h1 className="text-lg font-bold" style={{ fontFamily: "Georgia, serif", color: "#1F2937" }}>Planner - Gui - Finamob</h1>
        </div>
        <p className="text-xs mb-4" style={{ color: "#6B7280" }}>
          Quem é você? As atas, tarefas e cadastros deste app são compartilhados entre todas as pessoas que acessarem este link.
        </p>
        {users.length > 0 && (
          <div className="flex flex-col gap-1.5 mb-4 max-h-48 overflow-y-auto">
            {users.map((u) => (
              <button key={u.id} onClick={() => onPick(u)}
                className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm text-left hover:bg-gray-50"
                style={{ borderColor: C.line }}>
                <Avatar user={u} />
                <span className="flex-1 font-medium" style={{ color: "#1F2937" }}>{u.name}</span>
                <span className="text-xs" style={{ color: "#9CA3AF" }}>{u.area}</span>
              </button>
            ))}
          </div>
        )}
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#6B7280" }}>
          {users.length > 0 ? "Ou cadastre-se" : "Cadastre-se para começar"}
        </p>
        <div className="flex flex-col gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome completo"
            className="border rounded-lg px-3 py-2.5 text-sm outline-none" style={{ borderColor: C.line }} />
          <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Sua área (ex.: Comercial)"
            className="border rounded-lg px-3 py-2.5 text-sm outline-none" style={{ borderColor: C.line }} />
          <button
            onClick={() => { if (name.trim()) onCreate(name.trim(), area.trim()); }}
            className="rounded-lg py-2.5 text-sm font-semibold text-white flex items-center justify-center gap-2"
            style={{ background: C.stamp }}>
            <UserCircle2 size={16} /> Entrar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Abas de cadernos                                                    */
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

/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/* Editor                                                              */
/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/* Editor de blocos estruturados (templates semanais)                  */
/* ------------------------------------------------------------------ */
function SmartTextarea({ value, onChange, users, sections, placeholder, minH }) {
  const taRef = useRef(null);
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

  return (
    <div className="relative">
      <textarea
        ref={taRef}
        value={value || ""}
        onChange={handleChange}
        onKeyDown={(e) => {
          if (datePick && (e.key === " " || e.key === "Enter")) {
            const parsed = parseDateQ(dateQ);
            if (parsed) { e.preventDefault(); replaceToken(`📅 ${parsed} `); }
          }
        }}
        placeholder={placeholder}
        className="w-full outline-none resize-none text-sm leading-7 bg-transparent"
        style={{ color: "#1F2937", minHeight: minH || 120 }}
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
/* Painel visual do FUP (gerado dos blocos, com deltas da semana)      */
/* ------------------------------------------------------------------ */
function FupPanel({ blocks, prevBlocks, header }) {
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
          <Card title={`📞 Calls de pipe realizadas`} sub={`${fmtN(sumCol(pipeR, /opera/i))} ops mapeadas`}>
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

function BlocksEditor({ blocks, onChange, users, sections }) {
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
        if (b.type === "metric") return <MetricBlock key={b.id} b={b} onChange={(nb) => patch(i, nb)} />;
        if (b.type === "check") return <CheckBlock key={b.id} b={b} onChange={(nb) => patch(i, nb)} />;
        if (b.type === "list") return <ListBlock key={b.id} b={b} onChange={(nb) => patch(i, nb)} />;
        if (b.type === "table") return <TableBlock key={b.id} b={b} onChange={(nb) => patch(i, nb)}
          onPromote={promoteTargets(b) ? (ri) => promoteRow(i, ri) : null} promoteLabel={(promoteTargets(b) || {}).label} />;
        if (b.type === "sql") return <SqlBlock key={b.id} b={b} onChange={(nb) => patch(i, nb)} />;
        return <TextBlock key={b.id} b={b} onChange={(nb) => patch(i, nb)} users={users} sections={sections} />;
      })}
    </div>
  );
}

const BlockComment = ({ b, onChange }) => (
  <div className="flex items-start gap-1.5 mt-2 pt-2 border-t" style={{ borderColor: "#EDEDE6" }}>
    <span className="text-xs mt-1.5" title="Comentários">💬</span>
    <textarea
      value={b.comment || ""}
      onChange={(e) => onChange({ ...b, comment: e.target.value })}
      placeholder="Comentários deste bloco…"
      rows={1}
      className="flex-1 text-xs outline-none resize-none bg-transparent leading-5 pt-1"
      style={{ color: "#6B7280", minHeight: 24 }}
      onInput={(e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
    />
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

function CheckBlock({ b, onChange }) {
  return (
    <BlockCard title={b.title}>
      <button
        onClick={() => onChange({ ...b, checked: !b.checked })}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
        style={b.checked ? { background: "#E4F1EB", color: C.stamp } : { background: "#FCEBEB", color: "#A32D2D" }}>
        {b.checked ? <><Check size={15} /> Realizado</> : <><X size={15} /> Não realizado — tocar quando acontecer</>}
      </button>
      <BlockComment b={b} onChange={onChange} />
    </BlockCard>
  );
}

function MetricBlock({ b, onChange }) {
  return (
    <BlockCard title={b.title}>
      <input
        value={b.value || ""}
        onChange={(e) => onChange({ ...b, value: e.target.value })}
        placeholder="0" inputMode="numeric"
        className="w-32 border rounded-lg px-3 py-2 text-2xl font-semibold outline-none"
        style={{ borderColor: "#E3E5DE", background: "#fff", color: C.stamp }}
      />
      <BlockComment b={b} onChange={onChange} />
    </BlockCard>
  );
}

const cellCls = "border rounded-lg px-2 py-1.5 text-xs outline-none w-full";
const cellStyle = { borderColor: "#E3E5DE", background: "#fff", color: "#374151" };

function ListBlock({ b, onChange }) {
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
        <BlockComment b={b} onChange={onChange} />
      </div>
    </BlockCard>
  );
}

function TableBlock({ b, onChange, onPromote, promoteLabel }) {
  const [draft, setDraft] = useState((b.cols || []).map(() => ""));
  const rows = b.rows || [];
  const commit = () => {
    if (draft.some((c) => c.trim())) {
      onChange({ ...b, rows: [...rows, draft.map((c) => c.trim())] });
      setDraft((b.cols || []).map(() => ""));
    }
  };
  return (
    <BlockCard title={`${b.title} (${rows.length})`} hint={b.hint}>
      <div className="overflow-x-auto">
        <div className="min-w-fit flex flex-col gap-1">
          <div className="flex gap-1.5 pl-6 pr-6">
            {b.cols.map((c, i) => (
              <p key={i} className="text-xs font-semibold" style={{ color: "#6B7280", width: i === 0 ? 170 : 110, flexShrink: 0 }}>{c}</p>
            ))}
          </div>
          {rows.map((r, ri) => (
            <div key={ri} className="flex items-center gap-1.5">
              <span className="text-xs w-4 text-right shrink-0" style={{ color: "#9CA3AF" }}>{ri + 1}</span>
              {b.cols.map((c, ci) => (
                <input key={ci} value={r[ci] || ""}
                  onChange={(e) => onChange({ ...b, rows: rows.map((x, j) => (j === ri ? x.map((v, k) => (k === ci ? e.target.value : v)) : x)) })}
                  className={cellCls} style={{ ...cellStyle, width: ci === 0 ? 170 : 110, flexShrink: 0 }} />
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
                onBlur={(e) => { if (ci === b.cols.length - 1) commit(); }}
                placeholder={c}
                className={cellCls} style={{ ...cellStyle, width: ci === 0 ? 170 : 110, flexShrink: 0 }} />
            ))}
            <span className="w-4 shrink-0" />
          </div>
        </div>
      </div>
      <BlockComment b={b} onChange={onChange} />
    </BlockCard>
  );
}

function SqlBlock({ b, onChange }) {
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
      <BlockComment b={b} onChange={onChange} />
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
              className={cellCls} style={{ ...cellStyle, width: 170, flexShrink: 0 }} />
            <input value={r[1]} onChange={(e) => onChange(rows.map((x, j) => (j === i ? [x[0], e.target.value] : x)))}
              className={cellCls} style={{ ...cellStyle, width: 80, flexShrink: 0 }} placeholder="M" inputMode="decimal" />
            <button onClick={() => onChange(rows.filter((_, j) => j !== i))} style={{ color: C.danger }}><X size={13} /></button>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <input value={dn} onChange={(e) => setDn(e.target.value)} onKeyDown={(e) => e.key === "Enter" && commit()}
            placeholder="Incorporadora" className={cellCls} style={{ ...cellStyle, width: 170, flexShrink: 0 }} />
          <input value={dv} onChange={(e) => setDv(e.target.value)} onKeyDown={(e) => e.key === "Enter" && commit()} onBlur={commit}
            placeholder="M" className={cellCls} style={{ ...cellStyle, width: 80, flexShrink: 0 }} inputMode="decimal" />
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
      <BlockComment b={b} onChange={onChange} />
    </BlockCard>
  );
}

function Editor({ noteMeta, body, users, sections, prevBlocks, tplInfo, tplSiblings, onGoNote, onSaveTemplate, onTitle, onMeta, onBody, onConclude, structuring, error, saveState }) {
  const [tplSaved, setTplSaved] = useState(false);
  const [viewMode, setViewMode] = useState("edit"); // edit | panel
  const taRef = useRef(null);
  const [mentionQ, setMentionQ] = useState(null);
  const [tagQ, setTagQ] = useState(null);
  const [datePick, setDatePick] = useState(false);
  const [dateQ, setDateQ] = useState("");
  const [tokenLen, setTokenLen] = useState(0);

  const fmtDate = (d) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  const plusDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
  const parseDateQ = (q) => {
    const m = (q || "").match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if (!m) return null;
    const dd = +m[1], mo = +m[2];
    if (dd < 1 || dd > 31 || mo < 1 || mo > 12) return null;
    const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : new Date().getFullYear();
    return `${String(dd).padStart(2, "0")}/${String(mo).padStart(2, "0")}/${y}`;
  };
  const [recording, setRecording] = useState(false);
  const [interim, setInterim] = useState("");
  const [speechOk, setSpeechOk] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);
  const recRef = useRef(null);
  const recordingRef = useRef(false);

  const bgRef = useRef(null);

  const escHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const highlighted = useMemo(() => {
    let t = escHtml(body.content || "");
    const sortedUsers = [...users].sort((a, b) => b.name.length - a.name.length);
    sortedUsers.forEach((u) => {
      t = t.split("@" + escHtml(u.name)).join(`<span style="background:${C.mentionSoft};color:${C.mention};border-radius:4px">@${escHtml(u.name)}</span>`);
    });
    const sortedSecs = [...sections].sort((a, b) => b.name.length - a.name.length);
    sortedSecs.forEach((s) => {
      t = t.split("!" + escHtml(s.name)).join(`<span style="background:${C.stampSoft};color:${C.stamp};border-radius:4px">!${escHtml(s.name)}</span>`);
    });
    t = t.replace(/\*\*([^*\n]+)\*\*/g, (m, x) => `<span style="color:#111;text-shadow:0 0 .6px #111, 0 0 .6px #111">**${x}**</span>`);
    t = t.replace(/==([^=\n]+)==/g, (m, x) => `<span style="background:#FFF3B0;border-radius:3px">==${x}==</span>`);
    t = t.replace(/~~([^~\n]+)~~/g, (m, x) => `<span style="text-decoration:line-through;color:#9CA3AF">~~${x}~~</span>`);
    t = t.replace(/(^|[^\w])_([^_\n]+)_(?=[^\w]|$)/g, (m, p, x) => `${p}<span style="text-decoration:underline">_${x}_</span>`);
    t = t.replace(/📅\s*\d{2}\/\d{2}\/\d{4}/g, (m) => `<span style="background:${C.dateSoft};color:${C.date};border-radius:4px">${m}</span>`);
    t = t.replace(/\*/g, `<span style="color:#EF9F27;font-weight:700">*</span>`);
    if (t.endsWith("\n")) t += "\u200b";
    return t;
  }, [body.content, users, sections]); // eslint-disable-line

  const draftTasks = useMemo(() => parseDraftTasks(bodyText(body), users), [body.content, body.blocks, users]); // eslint-disable-line

  const normalizeDates = (text) =>
    text.replace(/#(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?![\d/])/g, (full, d, m, y) => {
      const parsed = parseDateQ(`${d}/${m}${y ? "/" + y : ""}`);
      return parsed ? `📅 ${parsed}` : full;
    });

  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const normalizeTokens = (text) => {
    let t = normalizeDates(text);
    // Corrigir capitalização de nomes/subtemas completos
    users.forEach((u) => { t = t.replace(new RegExp("@" + escRe(u.name), "gi"), "@" + u.name); });
    sections.forEach((s) => { t = t.replace(new RegExp("!" + escRe(s.name), "gi"), "!" + s.name); });
    // Expandir tokens curtos: @primeironome -> @Nome Completo (se único)
    t = t.replace(/@([\wÀ-ÿ]+)/g, (full, w, off, str) => {
      const matches = users.filter((u) => u.name.toLowerCase().startsWith(w.toLowerCase()));
      if (matches.length !== 1) return full;
      const cand = matches[0].name;
      const following = str.slice(off + 1, off + 1 + cand.length);
      if (following.toLowerCase() === cand.toLowerCase()) return full; // já está completo
      return "@" + cand;
    });
    // Expandir !inicio -> !Nome Do Subtema (se único)
    t = t.replace(/!([\wÀ-ÿ]+)/g, (full, w, off, str) => {
      const matches = sections.filter((s) => s.name.toLowerCase().startsWith(w.toLowerCase()));
      if (matches.length !== 1) return full;
      const cand = matches[0].name;
      const following = str.slice(off + 1, off + 1 + cand.length);
      if (following.toLowerCase() === cand.toLowerCase()) return full;
      return "!" + cand;
    });
    return t;
  };

  const handlePaste = (e) => {
    const paste = e.clipboardData && e.clipboardData.getData("text");
    if (!paste || !/[#@!]/.test(paste)) return; // sem comandos: colagem normal
    e.preventDefault();
    const converted = normalizeTokens(paste);
    const ta = taRef.current;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const newText = body.content.slice(0, start) + converted + body.content.slice(end);
    onBody({ content: newText });
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + converted.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const handleChange = (e) => {
    const text = e.target.value;
    onBody({ content: text });
    const caret = e.target.selectionStart;
    const before = text.slice(0, caret);
    const mMention = before.match(/(^|\s)@([\wÀ-ÿ]*)$/);
    const mTag = before.match(/(^|\s)!([\wÀ-ÿ]*)$/);
    const mHash = before.match(/(^|\s)#([\d/]{0,10})$/);
    const mDate = before.match(/(^|\s)\/data$/i);
    if (mHash) { setDatePick(true); setDateQ(mHash[2]); setTokenLen(mHash[2].length + 1); setMentionQ(null); setTagQ(null); }
    else if (mDate) { setDatePick(true); setDateQ(""); setTokenLen(5); setMentionQ(null); setTagQ(null); }
    else if (mMention) { setMentionQ(mMention[2]); setTokenLen(mMention[2].length + 1); setDatePick(false); setTagQ(null); }
    else if (mTag) { setTagQ(mTag[2]); setTokenLen(mTag[2].length + 1); setDatePick(false); setMentionQ(null); }
    else { setMentionQ(null); setTagQ(null); setDatePick(false); }
  };

  const replaceToken = (replacement) => {
    const ta = taRef.current;
    const caret = ta.selectionStart;
    const text = body.content;
    const newText = text.slice(0, caret - tokenLen) + replacement + text.slice(caret);
    onBody({ content: newText });
    setMentionQ(null); setTagQ(null); setDatePick(false);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = caret - tokenLen + replacement.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const filtered = users.filter((u) =>
    mentionQ === null ? false : u.name.toLowerCase().includes(mentionQ.toLowerCase())
  );

  const [fileMsg, setFileMsg] = useState(null);
  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    if (f.type.startsWith("audio") || /\.(mp3|m4a|wav|ogg|aac|opus)$/i.test(f.name)) {
      setFileMsg("Recebi o áudio, mas a transcrição automática de arquivos gravados só existe na versão completa (serviço dedicado com identificação de quem fala). Por enquanto: transcreva ao vivo pela gravação/ditado, ou envie a transcrição em texto (.txt ou .srt).");
      setShowTranscript(true);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      let text = String(reader.result || "");
      if (/\.(srt|vtt)$/i.test(f.name)) {
        text = text
          .replace(/^WEBVTT.*$/m, "")
          .replace(/^\d+\s*$/gm, "")
          .replace(/\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*.*$/gm, "")
          .replace(/\n{2,}/g, "\n").trim();
      }
      onBody((b) => ({ transcript: (((b && b.transcript) || "") + "\n" + text).trim() }));
      setFileMsg(`Transcrição "${f.name}" importada — ela será usada para complementar a ata.`);
      setShowTranscript(true);
    };
    reader.readAsText(f, "utf-8");
  };

  const toggleRec = () => {
    if (recording) {
      recordingRef.current = false;
      recRef.current && recRef.current.stop();
      setRecording(false); setInterim("");
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSpeechOk(false); setShowTranscript(true); return; }
    const rec = new SR();
    rec.lang = "pt-BR"; rec.continuous = true; rec.interimResults = true;
    rec.onresult = (ev) => {
      let finalTxt = "", interimTxt = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) finalTxt += t + " ";
        else interimTxt += t;
      }
      if (finalTxt) onBody({ transcript: ((body.transcript || "") + " " + finalTxt).trim() });
      setInterim(interimTxt);
    };
    rec.onend = () => { if (recordingRef.current) { try { rec.start(); } catch (e) {} } };
    rec.onerror = () => { recordingRef.current = false; setRecording(false); setSpeechOk(false); setShowTranscript(true); };
    recRef.current = rec;
    recordingRef.current = true;
    rec.start();
    setRecording(true); setShowTranscript(true);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-5">
      <input
        value={noteMeta.title}
        onChange={(e) => onTitle(e.target.value)}
        placeholder="Nome da página…"
        className="w-full text-xl font-semibold bg-transparent outline-none mb-1"
        style={{ color: "#1F2937", fontFamily: "Georgia, serif" }}
      />
      <p className="text-xs mb-2" style={{ color: "#9CA3AF" }}>
        {noteMeta.createdAt} · <b style={{ color: C.mention }}>@</b> responsável · <b style={{ color: C.date }}>#</b> prazo · <b style={{ color: C.stamp }}>!</b> envia a outro subtema · <b style={{ color: C.date }}>*</b> importante
        {saveState === "saving" && <span style={{ color: "#B0B5BC" }}> · salvando…</span>}
        {saveState === "saved" && <span style={{ color: C.stamp }}> · salvo ✓</span>}
      </p>
      <input
        value={noteMeta.participants || ""}
        onChange={(e) => onMeta({ participants: e.target.value })}
        placeholder="👥 Participantes da reunião (separe por vírgula)"
        className="w-full text-sm rounded-lg border px-3 py-2 mb-2 outline-none"
        style={{ borderColor: C.line, background: "#fff", color: "#374151" }}
      />
      {tplInfo && (
        <div className="text-xs mb-2 flex items-center gap-1.5 flex-wrap" style={{ color: C.stamp }}>
          <FileText size={12} /> Modelo: <b>{tplInfo.name}</b>
          <label className="flex items-center gap-1" style={{ color: "#4B5563" }}>
            · data do FUP:
            <input type="date"
              value={(() => { const m = (noteMeta.createdAt || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ""; })()}
              onChange={(e) => {
                if (!e.target.value) return;
                const [y, mo, d] = e.target.value.split("-");
                const br = `${d}/${mo}/${y}`;
                const newTitle = (noteMeta.title || "").includes(noteMeta.createdAt)
                  ? noteMeta.title.replace(noteMeta.createdAt, br)
                  : noteMeta.title;
                onMeta({ createdAt: br, title: newTitle });
              }}
              className="border rounded-md px-1.5 py-0.5 text-xs outline-none" style={{ borderColor: C.line }} />
          </label>
          {tplInfo.prevDate
            ? <span> · comparará com <b>{tplInfo.prevDate}</b></span>
            : <span> · primeira semana (sem comparativo)</span>}
        </div>
      )}

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button onClick={toggleRec}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white"
          style={{ background: recording ? C.danger : C.inkSoft }}>
          {recording ? <Square size={14} /> : <Mic size={14} />}
          {recording ? "Parar gravação" : "Gravar reunião"}
          {recording && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
        </button>
        <button onClick={() => setShowTranscript((v) => !v)}
          className="px-3 py-1.5 rounded-lg text-sm" style={{ color: "#4B5563", background: "#E2E5E9" }}>
          Transcrição {body.transcript ? "•" : ""}
        </button>
        <label className="px-3 py-1.5 rounded-lg text-sm cursor-pointer" style={{ color: "#4B5563", background: "#E2E5E9" }}>
          ⬆ Importar
          <input type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.txt,.srt,.vtt" className="hidden" onChange={onFile} />
        </label>
        {body.blocks && (
          <button onClick={() => setViewMode((v) => (v === "panel" ? "edit" : "panel"))}
            className="px-3 py-1.5 rounded-lg text-sm font-medium"
            style={viewMode === "panel" ? { background: C.ink, color: "#fff" } : { background: C.stampSoft, color: C.stamp }}>
            {viewMode === "panel" ? "✏️ Editar" : "📊 Painel"}
          </button>
        )}
        {!tplInfo && (
          <button onClick={() => { onSaveTemplate(); setTplSaved(true); setTimeout(() => setTplSaved(false), 2000); }}
            className="px-3 py-1.5 rounded-lg text-sm" style={{ color: "#4B5563", background: "#E2E5E9" }} title="Transforma esta estrutura num modelo semanal reutilizável">
            {tplSaved ? "✓ Modelo salvo" : "Salvar como modelo"}
          </button>
        )}
        <div className="flex-1" />
        <button onClick={onConclude} disabled={structuring}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold text-white"
          style={{ background: C.stamp, opacity: structuring ? 0.7 : 1 }}>
          {structuring ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {structuring ? "Gerando ata…" : "Gerar ata"}
        </button>
      </div>
      {error && <p className="text-xs mb-2" style={{ color: C.danger }}>{error}</p>}
      {fileMsg && <p className="text-xs mb-2" style={{ color: C.date }}>{fileMsg}</p>}

      {showTranscript && (
        <div className="mb-3 rounded-xl border p-3 text-sm" style={{ borderColor: C.line, background: "#fff" }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#6B7280" }}>Transcrição da reunião</p>
          {!speechOk && (
            <p className="text-xs mb-2" style={{ color: C.date }}>
              Neste dispositivo não há reconhecimento de voz do navegador. Alternativa no iPhone: toque no campo abaixo e use o microfone do teclado (ditado) — a fala será transcrita ao vivo aqui.
            </p>
          )}
          <textarea
            value={(body.transcript || "") + (interim ? " " + interim : "")}
            onChange={(e) => onBody({ transcript: e.target.value })}
            placeholder="A fala da reunião aparece aqui em tempo real…"
            className="w-full h-24 outline-none resize-none text-sm"
            style={{ color: "#374151" }}
          />
        </div>
      )}

      {!body.blocks && (
        <div className="flex items-center gap-1 mb-1.5 flex-wrap">
          {[
            ["N", "**", "**", "Negrito", { fontWeight: 700 }],
            ["I", "_", "_", "Itálico", { fontStyle: "italic" }],
            ["S", "~~", "~~", "Riscado", { textDecoration: "line-through" }],
            ["🖍", "==", "==", "Destaque", {}],
          ].map(([label, pre, pos, title, st]) => (
            <button key={title} title={title}
              onClick={() => {
                const ta = taRef.current; if (!ta) return;
                const { selectionStart: a, selectionEnd: bEnd, value } = ta;
                const sel = value.slice(a, bEnd) || title.toLowerCase();
                const next = value.slice(0, a) + pre + sel + pos + value.slice(bEnd);
                onBody({ content: next });
                requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(a + pre.length, a + pre.length + sel.length); });
              }}
              className="w-8 h-8 rounded-lg text-sm border" style={{ borderColor: C.line, background: "#fff", color: "#374151", ...st }}>
              {label}
            </button>
          ))}
          <button title="Lista"
            onClick={() => {
              const ta = taRef.current; if (!ta) return;
              const { selectionStart: a, value } = ta;
              const lineStart = value.lastIndexOf("\n", a - 1) + 1;
              const next = value.slice(0, lineStart) + "• " + value.slice(lineStart);
              onBody({ content: next });
              requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(a + 2, a + 2); });
            }}
            className="w-8 h-8 rounded-lg text-sm border" style={{ borderColor: C.line, background: "#fff", color: "#374151" }}>
            •
          </button>
          <span className="text-xs ml-1" style={{ color: "#B0B5BC" }}>selecione o texto e toque no estilo</span>
        </div>
      )}
      {body.blocks ? (
        viewMode === "panel" ? (
          <>
            {tplSiblings && (() => {
              const idx = tplSiblings.findIndex((s) => s.id === noteMeta.id);
              const prev = idx > 0 ? tplSiblings[idx - 1] : null;
              const next = idx >= 0 && idx < tplSiblings.length - 1 ? tplSiblings[idx + 1] : null;
              return (
                <div className="flex items-center justify-center gap-2 mb-2 text-sm">
                  <button disabled={!prev} onClick={() => prev && onGoNote(prev.id)}
                    className="px-2.5 py-1 rounded-lg font-medium" style={{ background: prev ? C.stampSoft : "#EEF0F2", color: prev ? C.stamp : "#B0B5BC" }}>
                    ‹ {prev ? prev.date : "início"}
                  </button>
                  <span className="px-2 font-semibold" style={{ color: "#374151" }}>{noteMeta.createdAt}</span>
                  <button disabled={!next} onClick={() => next && onGoNote(next.id)}
                    className="px-2.5 py-1 rounded-lg font-medium" style={{ background: next ? C.stampSoft : "#EEF0F2", color: next ? C.stamp : "#B0B5BC" }}>
                    {next ? next.date : "atual"} ›
                  </button>
                </div>
              );
            })()}
            <FupPanel blocks={body.blocks} prevBlocks={prevBlocks} dateLabel={noteMeta.createdAt} />
          </>
        ) : (
        <BlocksEditor
          blocks={body.blocks.map((bl) => (bl.hint && /buscar \+3/i.test(bl.hint) ? { ...bl, hint: undefined } : bl))}
          onChange={(blocks) => onBody({ blocks })}
          users={users} sections={sections} />
        )
      ) : (
      <div className="relative rounded-xl border shadow-sm" style={{ borderColor: C.line, background: C.paper }}>
        <div
          ref={bgRef}
          aria-hidden
          className="absolute inset-0 p-5 text-sm leading-7 whitespace-pre-wrap break-words overflow-hidden pointer-events-none"
          style={{ color: "#1F2937", fontFamily: "inherit" }}
          dangerouslySetInnerHTML={{ __html: body.content ? highlighted : "" }}
        />
        <textarea
          ref={taRef}
          value={body.content}
          onChange={handleChange}
          onPaste={handlePaste}
          onScroll={(e) => { if (bgRef.current) bgRef.current.scrollTop = e.target.scrollTop; }}
          onKeyDown={(e) => {
            if (datePick && (e.key === " " || e.key === "Enter")) {
              const parsed = parseDateQ(dateQ);
              if (parsed) { e.preventDefault(); replaceToken(`📅 ${parsed} `); }
            }
          }}
          placeholder={"Anote livremente, como no OneNote…\n\nEx.: Ligar pro cliente @Ana #05/08 !Inbound"}
          className="relative w-full min-h-96 p-5 outline-none resize-none bg-transparent text-sm leading-7 break-words"
          style={{ color: "transparent", caretColor: "#1F2937" }}
        />

        {mentionQ !== null && (
          <div className="absolute left-5 top-14 z-10 rounded-xl border shadow-lg overflow-hidden w-64" style={{ background: "#fff", borderColor: C.line }}>
            <p className="px-3 py-1.5 text-xs font-semibold" style={{ background: C.mentionSoft, color: C.mention }}>Delegar para…</p>
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-xs" style={{ color: "#9CA3AF" }}>Ninguém encontrado — cadastre a equipe no ícone do topo.</p>
            )}
            {filtered.map((u) => (
              <button key={u.id} onClick={() => replaceToken("@" + u.name + " ")}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50">
                <Avatar user={u} />
                <span className="flex-1">{u.name}</span>
                <span className="text-xs" style={{ color: "#9CA3AF" }}>{u.area}</span>
              </button>
            ))}
          </div>
        )}

        {tagQ !== null && (
          <div className="absolute left-5 top-14 z-10 rounded-xl border shadow-lg overflow-hidden w-72" style={{ background: "#fff", borderColor: C.line }}>
            <p className="px-3 py-1.5 text-xs font-semibold" style={{ background: C.stampSoft, color: C.stamp }}>Enviar linha também para…</p>
            {sections.filter((s) => s.name.toLowerCase().includes(tagQ.toLowerCase())).length === 0 && (
              <p className="px-3 py-2 text-xs" style={{ color: "#9CA3AF" }}>Nenhum subtema encontrado.</p>
            )}
            {sections.filter((s) => s.name.toLowerCase().includes(tagQ.toLowerCase())).map((s) => (
              <button key={s.secId} onClick={() => replaceToken("!" + s.name + " ")}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50">
                <span className="flex-1 truncate">{s.name}</span>
                <span className="text-xs shrink-0" style={{ color: "#9CA3AF" }}>{s.nbName}</span>
              </button>
            ))}
          </div>
        )}

        {datePick && (
          <div className="absolute left-5 top-14 z-10 rounded-xl border shadow-lg p-3 w-72" style={{ background: "#fff", borderColor: C.line }}>
            <p className="text-xs font-semibold mb-2" style={{ color: C.date }}>
              {parseDateQ(dateQ)
                ? <>Espaço/Enter confirma <b>📅 {parseDateQ(dateQ)}</b></>
                : "Prazo: continue digitando (ex.: 05/08) ou escolha"}
            </p>
            <div className="flex gap-1.5 mb-2 flex-wrap">
              {[["Hoje", 0], ["Amanhã", 1], ["Em 1 semana", 7]].map(([label, n]) => (
                <button key={label} onClick={() => replaceToken(`📅 ${fmtDate(plusDays(n))} `)}
                  className="px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ background: C.dateSoft, color: C.date }}>
                  {label}
                </button>
              ))}
            </div>
            <input type="date"
              onChange={(e) => {
                if (!e.target.value) return;
                const [y, m, d] = e.target.value.split("-");
                replaceToken(`📅 ${d}/${m}/${y} `);
              }}
              className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none" style={{ borderColor: C.line }} />
          </div>
        )}
      </div>
      )}

      {(body.routed || []).length > 0 && (
        <p className="mt-3 text-xs flex items-center gap-1" style={{ color: C.stamp }}>
          ↗ {(body.routed || []).length} linha(s) encaminhada(s) para outros subtemas
        </p>
      )}

      {draftTasks.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#6B7280" }}>
            Tarefas detectadas ({draftTasks.length})
          </p>
          <div className="flex flex-col gap-1.5">
            {draftTasks.map((t, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: t.important ? "#EF9F27" : C.line, background: "#fff" }}>
                <Avatar user={t.user} />
                {t.important && <Star size={13} fill="#EF9F27" color="#EF9F27" className="shrink-0" />}
                <span className="flex-1 truncate" style={{ color: "#374151" }}>{t.text}</span>
                {t.date && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: C.dateSoft, color: C.date }}>
                    📅 {t.date}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ata concluída                                                       */
/* ------------------------------------------------------------------ */
function AtaDocument({ body, tasks, meta, prevBlocks, onReopen }) {
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
          <button onClick={copyTxt} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "#E2E5E9", color: "#374151" }}>Copiar</button>
          <a href={"https://wa.me/?text=" + encodeURIComponent(whatsTxt())} target="_blank" rel="noreferrer"
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white no-underline" style={{ background: "#1FAF57" }}>WhatsApp</a>
          <button onClick={onReopen} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "#E2E5E9", color: "#374151" }}>✏️ Reabrir</button>
        </div>
        <FupPanel blocks={body.blocks} prevBlocks={prevBlocks}
          header={{ title: s0.titulo || "FUP semanal — Farming", crumb: `FUP ${s0.data || ""}`, badge: "Semana atual" }} />
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
    );
  }

  const s = body.structured;
  const [copied, setCopied] = useState(null); // 'plain' | 'whats'

  const plain = () =>
    `ATA DE REUNIÃO — ${s.titulo}\nData: ${s.data}\n\nPARTICIPANTES\n${(s.participantes || []).map((p) => "- " + p).join("\n")}\n\nRESUMO\n${s.resumo}\n${(s.comparativo || []).length ? `\nCOMPARATIVO COM A SEMANA ANTERIOR\n${s.comparativo.map((p) => "- " + p).join("\n")}\n` : ""}\nPAUTA\n${(s.pauta || []).map((p) => "- " + p).join("\n")}\n\nDECISÕES\n${(s.decisoes || []).map((p) => "- " + p).join("\n")}\n\nAÇÕES\n${tasks.map((a) => `- ${a.text} — ${a.userName || "sem responsável"}${a.date ? " — prazo " + a.date : ""}`).join("\n")}`;

  const whats = () => {
    let t = `*📋 ATA DE REUNIÃO*\n*${s.titulo}* — _${s.data}_\n\n`;
    if ((s.participantes || []).length) t += `*👥 Participantes:* ${s.participantes.join(", ")}\n\n`;
    if (s.resumo) t += `*📝 Resumo*\n${s.resumo}\n\n`;
    if ((s.comparativo || []).length) t += `*📈 Comparativo semanal*\n${s.comparativo.map((d) => "• " + d).join("\n")}\n\n`;
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
      <div className="flex items-center gap-2 mb-3">
        <button onClick={onReopen} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm" style={{ background: "#E2E5E9", color: "#374151" }}>
          <Pencil size={13} /> Reabrir e editar
        </button>
        <div className="flex-1" />
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

      <div className="relative rounded-xl border shadow-sm p-6 md:p-8" style={{ background: C.paper, borderColor: C.line, fontFamily: "Georgia, serif" }}>
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
        {(s.comparativo || []).length > 0 && (
          <Sec label="📈 Comparativo com a semana anterior">
            {s.comparativo.map((p, i) => <p key={i} className="text-sm leading-7" style={{ color: "#374151" }}>• {p}</p>)}
          </Sec>
        )}
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
    </div>
  );
}

const Sec = ({ label, children }) => (
  <div className="mb-4">
    <p className="text-xs font-bold uppercase tracking-widest mb-1.5 pb-1 border-b" style={{ color: C.stamp, borderColor: C.line }}>{label}</p>
    {children}
  </div>
);

/* ------------------------------------------------------------------ */
/* Busca global + Pergunte à IA                                        */
/* ------------------------------------------------------------------ */
function SearchView({ meta, loadBody, onGo }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState(null);

  const allNotes = useMemo(() => {
    const list = [];
    (meta.notebooks || []).forEach((nb) => nb.sections.forEach((s) => s.notes.forEach((n) => list.push({ n, nb: nb.name, sec: s.name }))));
    return list;
  }, [meta]);

  const doSearch = async () => {
    const query = q.trim().toLowerCase();
    if (!query) return;
    setBusy(true); setAnswer(null);
    const found = [];
    for (const item of allNotes) {
      const inTitle = (item.n.title || "").toLowerCase().includes(query);
      let snippet = null;
      const b = await loadBody(item.n.id);
      const content = bodyText(b);
      const idx = content.toLowerCase().indexOf(query);
      if (idx >= 0) snippet = "…" + content.slice(Math.max(0, idx - 50), idx + 90).replace(/\n/g, " ") + "…";
      if (inTitle || snippet) found.push({ id: item.n.id, title: item.n.title || "Página sem nome", nb: item.nb, sec: item.sec, date: item.n.createdAt, snippet });
    }
    setResults(found);
    setBusy(false);
  };

  const askAI = async () => {
    const query = q.trim();
    if (!query) return;
    setBusy(true); setResults(null); setAnswer(null);
    try {
      const corpus = [];
      for (const item of allNotes) {
        const b = await loadBody(item.n.id);
        const content = bodyText(b) + " " + ((b && b.structured && JSON.stringify(b.structured)) || "");
        if (content.trim().length > 5) corpus.push(`### [${item.nb} · ${item.sec}] ${item.n.title} (${item.n.createdAt})\n${content.slice(0, 1500)}`);
        if (corpus.join("").length > 40000) break;
      }
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 1000,
          messages: [{ role: "user", content: `Você é a memória institucional do Planner - Gui - Finamob. Responda à pergunta abaixo APENAS com base nas páginas fornecidas, em português, de forma direta. Cite entre colchetes o título das páginas que fundamentam a resposta. Se não houver informação, diga que não encontrou.\n\nPERGUNTA: ${query}\n\nPÁGINAS:\n${corpus.join("\n\n") || "(vazio)"}` }],
        }),
      });
      const data = await res.json();
      const text = (data.content || []).map((c) => c.text || "").join("");
      setAnswer(text.trim() || "Não encontrei nada sobre isso nas suas páginas.");
    } catch (e) { setAnswer("Erro ao consultar a IA — tente novamente."); }
    setBusy(false);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-5">
      <h1 className="text-xl font-semibold mb-1" style={{ color: "#1F2937", fontFamily: "Georgia, serif" }}>Buscar no acervo</h1>
      <p className="text-xs mb-3" style={{ color: "#9CA3AF" }}>Procure em todas as páginas, ou pergunte à IA sobre o que já foi anotado e decidido.</p>
      <div className="flex gap-2 mb-2">
        <input value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") doSearch(); }}
          placeholder={'Ex.: "mailing parcerias" ou "o que decidimos sobre o Rafael?"'}
          className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: C.line, background: "#fff" }} />
      </div>
      <div className="flex gap-2 mb-4">
        <button onClick={doSearch} disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: C.inkSoft }}>
          <SearchIcon size={14} /> Buscar
        </button>
        <button onClick={askAI} disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: C.stamp }}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Perguntar à IA
        </button>
      </div>

      {answer && (
        <div className="rounded-xl border p-4 mb-4 text-sm whitespace-pre-wrap leading-6" style={{ borderColor: C.stamp, background: "#F4FAF7", color: "#1F2937" }}>
          {answer}
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

/* ------------------------------------------------------------------ */
/* Linha de tarefa reutilizável                                        */
/* ------------------------------------------------------------------ */
function TaskItem({ t, onToggle, onGo, users, onEdit, onPlusDays }) {
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

/* ------------------------------------------------------------------ */
/* Reuniões (agenda do Outlook)                                        */
/* ------------------------------------------------------------------ */
function MeetingsView({ agenda, loading, err, onRefresh }) {
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

/* ------------------------------------------------------------------ */
/* Meu dia (relatório diário)                                          */
/* ------------------------------------------------------------------ */
function ReportView({ agenda, meta, me, loading, onToggle, onGo, onRefresh, onSendAll, sendList, onMarkSent, onCloseSend, cloudAt, tmbKey, onWeekly, weekly, onCloseWeekly }) {
  const [copied, setCopied] = useState(false);
  const configured = tmbKey ? (meta.users || []).filter((u) => u.phone).length : 0;
  const autoToday = (meta.autoSend || "") === isoToday();
  const tKey = dateKeyBR(todayBR());
  const d = new Date();
  const localIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
      <div className="flex items-center gap-2 mb-1">
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
          {cloudAt ? ` · espelho OneDrive ✓ ${String(cloudAt.getHours()).padStart(2, "0")}:${String(cloudAt.getMinutes()).padStart(2, "0")}` : ""}
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
            ) : (
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}
/* ------------------------------------------------------------------ */
function TasksView({ meta, me, onToggle, onGo, scanning, onAddRec, onRemoveRec, onEdit, onPlusDays }) {
  const [who, setWho] = useState("mine"); // mine | all | userId
  const [when, setWhen] = useState("all"); // all | past | today | future
  const [showRec, setShowRec] = useState(false);
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

  const groups = useMemo(() => {
    const byUser = {};
    tasks.forEach((t) => {
      const key = t.userName || "Sem responsável";
      (byUser[key] = byUser[key] || []).push(t);
    });
    return byUser;
  }, [tasks]);

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

      {tasks.length === 0 && (
        <p className="text-sm" style={{ color: "#6B7280" }}>Nenhuma tarefa neste filtro.</p>
      )}

      {who === "all" ? (
        Object.keys(groups).map((name) => (
          <div key={name} className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              {groups[name][0] && userOf(groups[name][0]) ? <Avatar user={userOf(groups[name][0])} /> : null}
              <p className="text-sm font-semibold" style={{ color: "#1F2937" }}>{name}</p>
              <span className="text-xs" style={{ color: "#9CA3AF" }}>{groups[name].filter((i) => !i.done).length} pendente(s)</span>
            </div>
            <div className="flex flex-col gap-1.5">{groups[name].map(TaskRow)}</div>
          </div>
        ))
      ) : (
        <div className="flex flex-col gap-1.5">{tasks.map(TaskRow)}</div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lixeira                                                             */
/* ------------------------------------------------------------------ */
function TrashView({ meta, onRestore, onPurge, onEmpty }) {
  const trash = meta.trash || [];
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  return (
    <div className="max-w-3xl mx-auto px-4 py-5">
      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-xl font-semibold flex-1" style={{ color: "#1F2937", fontFamily: "Georgia, serif" }}>Lixeira</h1>
        {trash.length > 0 && (
          confirmEmpty ? (
            <button onClick={() => { onEmpty(); setConfirmEmpty(false); }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: C.danger }}>
              Confirmar exclusão de tudo
            </button>
          ) : (
            <button onClick={() => setConfirmEmpty(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "#FBE9E7", color: C.danger }}>
              Esvaziar lixeira
            </button>
          )
        )}
      </div>
      <p className="text-xs mb-4" style={{ color: "#9CA3AF" }}>Páginas descartadas ficam guardadas aqui até serem restauradas ou excluídas definitivamente.</p>
      {trash.length === 0 && <p className="text-sm" style={{ color: "#6B7280" }}>A lixeira está vazia.</p>}
      <div className="flex flex-col gap-1.5">
        {trash.map((t) => (
          <div key={t.id} className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm" style={{ borderColor: C.line, background: "#fff" }}>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate" style={{ color: "#1F2937" }}>{t.title || "Página sem nome"}</p>
              <p className="text-xs" style={{ color: "#9CA3AF" }}>{t.nbName} · {t.secName} · excluída em {t.deletedAt}</p>
            </div>
            <button onClick={() => onRestore(t.id)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium" style={{ background: C.stampSoft, color: C.stamp }}>
              Restaurar
            </button>
            <button onClick={() => onPurge(t.id)} className="p-1.5" style={{ color: C.danger }} title="Excluir definitivamente">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Equipe                                                              */
/* ------------------------------------------------------------------ */
function TeamModal({ users, me, tmbKey, onSaveKey, onExport, onImport, onClose, onAdd, onUpdate, onRemove, onSwitch }) {
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [cfg, setCfg] = useState(null); // {id, phone}
  const [tKey, setTKey] = useState(tmbKey);
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4" style={{ background: "rgba(20,26,38,.5)" }}>
      <div className="w-full max-w-sm rounded-2xl p-5 max-h-full overflow-y-auto" style={{ background: "#fff" }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold" style={{ color: "#1F2937" }}>Equipe cadastrada</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="flex flex-col gap-1.5 mb-4 max-h-72 overflow-y-auto">
          {users.map((u) => (
            <div key={u.id} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: C.line }}>
              <div className="flex items-center gap-2">
                <Avatar user={u} />
                <span className="flex-1 truncate">{u.name}{me?.id === u.id ? " (você)" : ""}</span>
                <span className="text-xs" style={{ color: "#9CA3AF" }}>{u.area}</span>
                <button onClick={() => setCfg(cfg && cfg.id === u.id ? null : { id: u.id, name: u.name, area: u.area || "", phone: u.phone || "", email: u.email || "" })}
                  className="text-xs px-2 py-1 rounded-lg shrink-0"
                  style={u.phone ? { background: "#E4F1EB", color: C.stamp } : { background: "#E2E5E9", color: "#4B5563" }}>
                  {u.phone ? "✓ Editar" : "Editar"}
                </button>
                {me?.id !== u.id && (
                  <button onClick={() => onRemove(u.id)} style={{ color: C.danger }}><Trash2 size={13} /></button>
                )}
              </div>
              {cfg && cfg.id === u.id && (
                <div className="mt-2 pt-2 border-t flex flex-col gap-1.5" style={{ borderColor: C.line }}>
                  <input value={cfg.name} onChange={(e) => setCfg({ ...cfg, name: e.target.value })}
                    placeholder="Nome completo"
                    className="border rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ borderColor: C.line }} />
                  <input value={cfg.area} onChange={(e) => setCfg({ ...cfg, area: e.target.value })}
                    placeholder="Área (ex.: Comercial)"
                    className="border rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ borderColor: C.line }} />
                  <input value={cfg.phone} onChange={(e) => setCfg({ ...cfg, phone: e.target.value })}
                    placeholder="Telefone com DDI (ex.: 5511999998888)" inputMode="numeric"
                    className="border rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ borderColor: C.line }} />
                  <input value={cfg.email} onChange={(e) => setCfg({ ...cfg, email: e.target.value })}
                    placeholder="E-mail do trabalho (ex.: ana@empresa.com.br)" inputMode="email"
                    className="border rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ borderColor: C.line }} />
                  {cfg.name.trim() !== u.name && (
                    <p className="text-xs" style={{ color: C.date }}>
                      Atenção: ao renomear, as menções @{u.name} já escritas nas páginas antigas deixam de casar com o novo nome (as tarefas existentes serão atualizadas, mas edite as páginas se quiser manter o vínculo).
                    </p>
                  )}
                  <button
                    onClick={() => {
                      if (!cfg.name.trim()) return;
                      onUpdate(u.id, { name: cfg.name.trim(), area: cfg.area.trim() || "Geral", phone: cfg.phone.replace(/\D/g, ""), email: cfg.email.trim().toLowerCase() });
                      setCfg(null);
                    }}
                    className="rounded-lg py-1.5 text-xs font-medium text-white" style={{ background: C.stamp }}>
                    Salvar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#6B7280" }}>Envio do relatório diário (TextMeBot)</p>
        <div className="flex flex-col gap-1.5 mb-3 rounded-lg border p-2" style={{ borderColor: C.line, background: "#F5F6F8" }}>
          <p className="text-xs" style={{ color: "#6B7280" }}>
            O relatório é disparado do WhatsApp da empresa para todos com telefone cadastrado. Obtenha a chave conectando o número em{" "}
            <a href="https://textmebot.com/" target="_blank" rel="noreferrer" className="underline" style={{ color: C.stamp }}>textmebot.com</a>
            {" "}(demo grátis de 2 dias; use um número secundário).
          </p>
          <div className="flex gap-1.5">
            <input value={tKey} onChange={(e) => setTKey(e.target.value)} placeholder="Chave (apikey) do TextMeBot"
              className="flex-1 border rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ borderColor: C.line }} />
            <button onClick={() => onSaveKey(tKey.trim())}
              className="px-3 rounded-lg text-xs font-medium text-white" style={{ background: C.stamp }}>
              Salvar
            </button>
          </div>
          {tmbKey && <p className="text-xs" style={{ color: C.stamp }}>✓ chave configurada</p>}
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#6B7280" }}>Dados</p>
        <div className="flex gap-1.5 mb-3">
          <button onClick={onExport} className="flex-1 rounded-lg py-1.5 text-xs font-medium border" style={{ borderColor: C.line, color: "#374151", background: "#fff" }}>
            ⬇ Exportar dados
          </button>
          <button onClick={onImport} className="flex-1 rounded-lg py-1.5 text-xs font-medium border" style={{ borderColor: C.line, color: "#374151", background: "#fff" }}>
            ⬆ Importar dados
          </button>
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#6B7280" }}>Adicionar pessoa</p>
        <div className="flex flex-col gap-2 mb-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo"
            className="border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: C.line }} />
          <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Área"
            className="border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: C.line }} />
          <button
            onClick={() => { if (name.trim()) { onAdd(name.trim(), area.trim()); setName(""); setArea(""); } }}
            className="rounded-lg py-2 text-sm font-medium text-white" style={{ background: C.stamp }}>
            Cadastrar
          </button>
        </div>
        <p className="text-center text-xs mt-3 mb-1" style={{ color: "#B0B5BC" }}>{APP_BUILD}</p>
        <button onClick={onSwitch} className="w-full text-center text-xs underline" style={{ color: "#6B7280" }}>
          Trocar de usuário neste aparelho
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
function Avatar({ user }) {
  if (!user) return null;
  const initials = user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span className="w-6 h-6 rounded-full flex items-center justify-center text-white shrink-0"
      style={{ background: user.color, fontSize: 10, fontWeight: 700 }}>
      {initials}
    </span>
  );
}
