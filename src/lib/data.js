import { uid, todayBR } from "./util.js";
import { GRUPOS_SQL, consolidadoEff } from "./blocks.js";

/* Funde dois estados do app sem perder criações de nenhum lado.
   Regra: união por id (páginas, tarefas, pessoas, modelos, recorrentes);
   a lixeira funciona como lápide — o que está nela não ressuscita. */
export function mergeMeta(local, remote) {
  const byId = (arr) => { const m = {}; (arr || []).forEach((x) => { m[x.id] = x; }); return m; };
  const trashIds = new Set([...(local.trash || []), ...(remote.trash || [])].map((t) => t.id));
  // lápides de abas/subtemas excluídos — impedem que voltem vindos do outro lado
  const zapIds = new Set([...(local.zapped || []), ...(remote.zapped || [])].map((z) => z.id));
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
      if (!lm[s.id] && !zapIds.has(s.id)) out.push({ ...s, notes: (s.notes || []).filter((n) => !trashIds.has(n.id)) });
    });
    return out.filter((s) => !zapIds.has(s.id));
  };
  const mergeNbs = (lb, rb) => {
    const rm = byId(rb);
    const lm = byId(lb);
    const out = (lb || []).map((nb) => rm[nb.id] ? { ...nb, sections: mergeSections(nb.sections, rm[nb.id].sections) } : nb);
    (rb || []).forEach((nb) => { if (!lm[nb.id] && !zapIds.has(nb.id)) out.push(nb); });
    return out.filter((nb) => !zapIds.has(nb.id));
  };
  return {
    ...remote,
    ...local,
    notebooks: mergeNbs(local.notebooks, remote.notebooks),
    trash: unionById(local.trash, remote.trash),
    zapped: unionById(local.zapped, remote.zapped),
    tasks: unionById(local.tasks, remote.tasks),
    users: unionById(local.users, remote.users),
    templates: unionById(local.templates, remote.templates),
    recurring: unionById(local.recurring, remote.recurring),
  };
}

export function blocksToText(blocks) {
  if (!blocks || !blocks.length) return "";
  return blocks.map((b) => {
    let base = "";
    if (b.type === "metric") base = `${b.title}: ${b.value || "?"}`;
    else if (b.type === "reunioes") base = `${b.title}: agendadas ${b.agendadas || "?"} · realizadas ${b.realizadas || "?"} · de cards existentes ${b.cards || "?"}`;
    else if (b.type === "leads") base = `${b.title}: inbound ${b.inbound || "?"} · remarketing ${b.remarketing || "?"}`;
    else if (b.type === "check") base = `${b.title}: ${b.checked ? "Realizado ✔" : "Não realizado ✖"}`;
    else if (b.type === "text") base = `${b.title}:\n${b.text || ""}`;
    else if (b.type === "fup") base = `${b.title}${b.date ? ` — ${b.date}` : ""}:\n${b.text || ""}`;
    else if (b.type === "consolidado") {
      const e = (k) => consolidadoEff(b, k);
      if (b.kind === "parcerias")
        base = `${b.title}${b.mes ? ` (${b.mes})` : ""}: SQL aprovados ${e("aprovados")}M; aprovados extraordinário ${e("aprovadosExtra")}M; ressalvados ${e("ressalvados")}M; reprovados ${e("reprovados")}M; calls com clientes ${e("callsClientes")}; novos parceiros ${e("novosParceiros")}`;
      else if (b.kind === "farming")
        base = `${b.title}${b.mes ? ` (${b.mes})` : ""}: visitas realizadas ${e("visitas")}; calls de pipe realizadas ${e("callsPipe")}; SQL aprovados ${e("aprovados")}M; aprovados extraordinário ${e("aprovadosExtra")}M; ressalvados ${e("ressalvados")}M; reprovados ${e("reprovados")}M`;
      else if (b.kind === "outbound")
        base = `${b.title}${b.mes ? ` (${b.mes})` : ""}: calls realizadas ${e("reunioes")}; SQL aprovados ${e("aprovados")}M; aprovados extraordinário ${e("aprovadosExtra")}M; ressalvados ${e("ressalvados")}M; reprovados ${e("reprovados")}M`;
      else
        base = `${b.title}${b.mes ? ` (${b.mes})` : ""}: reuniões realizadas ${e("reunioes")}; leads inbound ${e("leadsIn")}; leads remarketing ${e("leadsRem")}; SQL aprovados ${e("aprovados")}M; aprovados extraordinário ${e("aprovadosExtra")}M; ressalvados ${e("ressalvados")}M; reprovados ${e("reprovados")}M`;
    }
    else if (b.type === "list") base = `${b.title}:\n${(b.rows || []).map((r, i) => `${i + 1}. ${r}`).join("\n")}`;
    else if (b.type === "table") base = `${b.title} (${(b.cols || []).join(" · ")}):\n${(b.rows || []).map((r) => "- " + r.filter(Boolean).join(" · ")).join("\n")}`;
    else if (b.type === "sql") {
      const g = (name, arr) => `${name}:\n${(arr || []).map((r) => `\t${r[0]} - ${r[1]}M`).join("\n")}`;
      base = `${b.title} (último comitê: ${b.comite || "?"})\n${GRUPOS_SQL.map(([k, rotulo]) => g(rotulo, b[k])).join("\n")}`;
    }
    if (b.comment && b.comment.trim()) base += `\nComentários: ${b.comment.trim()}`;
    return base;
  }).filter((x) => x && x.trim()).join("\n\n");
}

/* Transcrições coladas na página. Ficam FORA do blocksToText de propósito: são
   longas e não devem entrar na ata, no texto do WhatsApp nem nos prompts de IA.
   Entram só na busca, para achar o que foi falado na reunião. */
export const transcricoesToText = (blocks) => (blocks || [])
  .filter((b) => b.type === "transcricao" && (b.text || "").trim())
  .map((b) => `${b.title}:\n${b.text.trim()}`)
  .join("\n\n");

export const bodyText = (b) => (!b ? "" : [blocksToText(b.blocks), b.content].filter((x) => x && x.trim()).join("\n\n"));

/* Detecta tarefas nas anotações: linhas com @responsável (+ 📅 prazo e * importante) */
export function parseDraftTasks(content, users) {
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

/* Reconcilia as tarefas de uma página com as linhas atuais das anotações.
   As tarefas da ata (origin "ia") são preservadas como estão; os @ digitados
   depois também viram tarefas — sem duplicar o que a ata já criou. */
export function reconcileTasks(allTasks, note, nbName, content, users) {
  const existing = allTasks.filter((t) => t.noteId === note.id);
  const iaTasks = existing.filter((t) => t.origin === "ia");
  const draftTasks = existing.filter((t) => t.origin !== "ia");
  const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  const jaNaAta = (d) => iaTasks.some((t) => {
    if (t.userId !== d.user.id) return false;
    const a = norm(t.text), b = norm(d.text);
    return a && b && (a.includes(b) || b.includes(a));
  });
  const drafts = parseDraftTasks(content, users).filter((d) => !jaNaAta(d));
  if (!drafts.length && !draftTasks.length) return allTasks;
  const sig = (t) => `${t.userId}|${t.text}|${t.date || ""}|${t.important ? 1 : 0}`;
  const pools = {};
  draftTasks.forEach((t) => { (pools[sig(t)] = pools[sig(t)] || []).push(t); });
  let changed = drafts.length !== draftTasks.length;
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
  return [...allTasks.filter((t) => t.noteId !== note.id), ...iaTasks, ...next];
}

export function seedMeta() {
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
    templates: [],
    trash: [],
    recurring: [],
    _seedNoteId: nId,
  };
}

export const SEED_BODY = {
  content:
    "Escreva livremente, como no OneNote.\n\nDigite @ para delegar uma tarefa a alguém da equipe e # para marcar um prazo.\n\nAs tarefas detectadas aparecem em Pendências automaticamente.",
  transcript: "",
  structured: null,
};
