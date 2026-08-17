import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen, CalendarDays, CheckSquare, ChevronRight, ClipboardList, ExternalLink, FileText,
  FolderInput, Loader2, Menu, Pencil, Plus, RefreshCw, Redo2, Search as SearchIcon,
  Send, Trash2, Undo2, X,
} from "lucide-react";
import { C, USER_COLORS, dateKeyBR, isoToday, monthLabel, plusDaysBR, todayBR, uid } from "./lib/util.js";
import { SEED_BODY, bodyText, reconcileTasks, seedMeta } from "./lib/data.js";
import { FARMING_BLOCKS, INBOUND_BLOCKS, OUTBOUND_BLOCKS, PARCERIAS_BLOCKS, FUP_MURILO_BLOCK, TRANSCRICAO_BLOCK, MIA_BLOCKS, CONSOLIDADO_BLOCK, CONSOLIDADO_PARCERIAS_BLOCK, CONSOLIDADO_FARMING_BLOCK, CONSOLIDADO_OUTBOUND_BLOCK, upgradeReunioes, upgradeLeads, upgradeVisitas, upgradeLive } from "./lib/blocks.js";
import { TEXT_SCHEMA, callDirect, enqueueRequest, getAnthropicKey, getLegacyLocalKey, pollResponse, setRuntimeAnthropicKey } from "./ia.js";
import { gerarAtaLocal, resumoSemanalLocal } from "./lib/ataLocal.js";
import { fetchCalendarEvents } from "./agenda.js";
import { deleteFile, ensureFolder, getDownloadUrl, readJsonFile, uploadBinaryFile, uploadLargeFile } from "./onedrive.js";
import { imgPath, prepareImage } from "./components/PageImages.jsx";
import { filePath } from "./components/PageFiles.jsx";
import { usePlannerData } from "./store.js";
import AtaDocument from "./components/AtaDocument.jsx";
import Avatar from "./components/Avatar.jsx";
import Editor from "./components/Editor.jsx";
import IdentifyScreen from "./components/IdentifyScreen.jsx";
import MeetingsView from "./components/MeetingsView.jsx";
import ReportView from "./components/ReportView.jsx";
import SearchView from "./components/SearchView.jsx";
import TasksView from "./components/TasksView.jsx";
import TeamModal from "./components/TeamModal.jsx";
import TrashView from "./components/TrashView.jsx";

const APP_BUILD = "Sessão 5 · app completo — instalável, com migração";
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

  // Templates estruturados v2 (FUP Farming / Inbound / Parcerias)
  if (!m.templates) { m = { ...m, templates: [] }; changed = true; }
  if (!m.templates.some((t) => t.v === 2 && /farming/i.test(t.name))) {
    m = { ...m, templates: [{ id: uid(), name: "FUP Semanal — Farming", v: 2, blocksDef: FARMING_BLOCKS() }, ...m.templates] };
    changed = true;
  }
  if (!m.templates.some((t) => /inbound/i.test(t.name))) {
    m = { ...m, templates: [...m.templates, { id: uid(), name: "FUP Semanal — Inbound", v: 2, blocksDef: INBOUND_BLOCKS() }] };
    changed = true;
  }
  if (!m.templates.some((t) => /parceria/i.test(t.name))) {
    m = { ...m, templates: [...m.templates, { id: uid(), name: "FUP Semanal — Parcerias", v: 2, blocksDef: PARCERIAS_BLOCKS() }] };
    changed = true;
  }
  if (!m.templates.some((t) => /outbound/i.test(t.name))) {
    m = { ...m, templates: [...m.templates, { id: uid(), name: "FUP Semanal — Outbound", v: 2, blocksDef: OUTBOUND_BLOCKS() }] };
    changed = true;
  }
  // Blocos da MIA no modelo Inbound já existente (antes do TEMA GERAL)
  const iIdx = m.templates.findIndex((t) => t.v === 2 && /inbound/i.test(t.name));
  if (iIdx >= 0 && !(m.templates[iIdx].blocksDef || []).some((b) => /MIA/i.test(b.title || ""))) {
    const def = [...(m.templates[iIdx].blocksDef || [])];
    const pos = def.findIndex((b) => /TEMA GERAL/i.test(b.title || ""));
    def.splice(pos >= 0 ? pos : def.length, 0, ...MIA_BLOCKS());
    m = { ...m, templates: m.templates.map((t, i) => (i === iIdx ? { ...t, blocksDef: def } : t)) };
    changed = true;
  }
  // Inbound: blocos duplos (reuniões, leads) + consolidado no topo
  if (iIdx >= 0) {
    let def = m.templates[iIdx].blocksDef || [];
    let mudou = false;
    const def2 = upgradeReunioes(def);
    if (def2 !== def) { def = def2; mudou = true; }
    const def3 = upgradeLeads(def);
    if (def3 !== def) { def = def3; mudou = true; }
    if (!def.some((b) => b.type === "consolidado")) { def = [CONSOLIDADO_BLOCK(), ...def]; mudou = true; }
    if (mudou) {
      m = { ...m, templates: m.templates.map((t, i) => (i === iIdx ? { ...t, blocksDef: def } : t)) };
      changed = true;
    }
  }
  // Lixeira: itens com mais de 30 dias são excluídos definitivamente
  const cut = new Date(); cut.setDate(cut.getDate() - 30);
  const cutKey = `${cut.getFullYear()}${String(cut.getMonth() + 1).padStart(2, "0")}${String(cut.getDate()).padStart(2, "0")}`;
  const expirados = (m.trash || []).filter((t) => dateKeyBR(t.deletedAt) && dateKeyBR(t.deletedAt) < cutKey);
  if (expirados.length) {
    expirados.forEach((t) => { delete bodies[t.id]; });
    const expIds = new Set(expirados.map((t) => t.id));
    m = { ...m, trash: m.trash.filter((t) => !expIds.has(t.id)) };
    changed = true;
  }

  // Farming: coluna Cidade/UF nas Visitas a Agendar + consolidado no topo
  const fIdx2 = m.templates.findIndex((t) => t.v === 2 && /farming/i.test(t.name));
  if (fIdx2 >= 0) {
    let def = m.templates[fIdx2].blocksDef || [];
    let mudou = false;
    const def2 = upgradeVisitas(def);
    if (def2 !== def) { def = def2; mudou = true; }
    if (!def.some((b) => b.type === "consolidado")) { def = [CONSOLIDADO_FARMING_BLOCK(), ...def]; mudou = true; }
    if (mudou) {
      m = { ...m, templates: m.templates.map((t, i) => (i === fIdx2 ? { ...t, blocksDef: def } : t)) };
      changed = true;
    }
  }

  // Parcerias: bloco Live do Mês abaixo do Café da Manhã + consolidado no topo
  const pIdx2 = m.templates.findIndex((t) => t.v === 2 && /parceria/i.test(t.name));
  if (pIdx2 >= 0) {
    let def = m.templates[pIdx2].blocksDef || [];
    let mudou = false;
    const def2 = upgradeLive(def);
    if (def2 !== def) { def = def2; mudou = true; }
    if (!def.some((b) => b.type === "consolidado")) { def = [CONSOLIDADO_PARCERIAS_BLOCK(), ...def]; mudou = true; }
    if (mudou) {
      m = { ...m, templates: m.templates.map((t, i) => (i === pIdx2 ? { ...t, blocksDef: def } : t)) };
      changed = true;
    }
  }

  // Outbound: consolidado do mês no topo (calls + SQLs)
  const oIdx2 = m.templates.findIndex((t) => t.v === 2 && /outbound/i.test(t.name));
  if (oIdx2 >= 0) {
    const def = m.templates[oIdx2].blocksDef || [];
    if (!def.some((b) => b.type === "consolidado")) {
      m = { ...m, templates: m.templates.map((t, i) => (i === oIdx2 ? { ...t, blocksDef: [CONSOLIDADO_OUTBOUND_BLOCK(), ...def] } : t)) };
      changed = true;
    }
  }

  // FUP Murilo (segundas): garante o bloco no fim dos três modelos de FUP já existentes
  const semFup = (t) => t.v === 2 && /farming|inbound|outbound|parceria/i.test(t.name) && !(t.blocksDef || []).some((b) => b.type === "fup");
  if (m.templates.some(semFup)) {
    m = { ...m, templates: m.templates.map((t) => (semFup(t) ? { ...t, blocksDef: [...(t.blocksDef || []), FUP_MURILO_BLOCK()] } : t)) };
    changed = true;
  }

  // Transcrição da reunião: garante o bloco no fim dos modelos de FUP já existentes
  const semTranscricao = (t) => t.v === 2 && /farming|inbound|outbound|parceria/i.test(t.name) && !(t.blocksDef || []).some((b) => b.type === "transcricao");
  if (m.templates.some(semTranscricao)) {
    m = { ...m, templates: m.templates.map((t) => (semTranscricao(t) ? { ...t, blocksDef: [...(t.blocksDef || []), TRANSCRICAO_BLOCK()] } : t)) };
    changed = true;
  }

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
  const { cloudPhase, cloudErr, meta, setMeta, metaRef, loadBody, saveBody, deleteBodyKey, saveState, syncing, syncNow, tmbKey, saveTmbKey, anthropicKey, saveAnthropicKey, getSnapshot, importData, undo, redo, restoreTick, canUndo, canRedo } = store;

  /* chave da IA sincronizada: espelha no módulo de IA e migra a legada do navegador */
  useEffect(() => {
    setRuntimeAnthropicKey(anthropicKey);
    if (cloudPhase === "pronto" && !anthropicKey && getLegacyLocalKey()) {
      saveAnthropicKey(getLegacyLocalKey());
    }
  }, [anthropicKey, cloudPhase]); // eslint-disable-line

  const [me, setMe] = useState(null);
  const [phase, setPhase] = useState("boot"); // boot | identify | ready
  const [nbId, setNbId] = useState(null);
  const [secId, setSecId] = useState(null);
  const [noteId, setNoteId] = useState(null);
  const [body, setBody] = useState(null);
  const [bodyFor, setBodyFor] = useState(null); // id da página a que o body carregado pertence
  const [view, setView] = useState("editor");
  const [showSide, setShowSide] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [secEdit, setSecEdit] = useState(null);
  const [diariosOpen, setDiariosOpen] = useState(false);
  const [moveId, setMoveId] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [showTpl, setShowTpl] = useState(false);
  const [tplDate, setTplDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [prevBlocks, setPrevBlocks] = useState(null);
  const [iaErr, setIaErr] = useState({}); // noteId -> mensagem
  const [directBusy, setDirectBusy] = useState(false);
  const noteIdRef = useRef(null);
  const [agenda, setAgenda] = useState({ fetchedAt: 0, events: [] });
  const [agendaLoading, setAgendaLoading] = useState(false);
  const [agendaErr, setAgendaErr] = useState(null);
  const agendaRef = useRef({ fetchedAt: 0, events: [] });
  const agendaLoadingRef = useRef(false);
  const [sendList, setSendList] = useState(null); // [{id,name,url,done}] | null
  const [pendingAuto, setPendingAuto] = useState(false);
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [weeklyBusy, setWeeklyBusy] = useState(false);
  const [acervoBusy, setAcervoBusy] = useState(false);
  const [backup, setBackup] = useState(null); // backup do OneDrive detectado
  const [importing, setImporting] = useState(false);
  const [importErr, setImportErr] = useState(null);
  const [xfer, setXfer] = useState(null); // {mode:'export'|'import', text, err?}

  useEffect(() => { setDiariosOpen(false); }, [secId]);
  useEffect(() => { noteIdRef.current = noteId; }, [noteId]);
  useEffect(() => { agendaRef.current = agenda; }, [agenda]);

  /* ---------- entrada: identificar usuário e abrir o Diário de hoje ---------- */
  useEffect(() => {
    if (cloudPhase !== "pronto" || phase !== "boot") return;
    const ids = idsRef.current;
    if (ids) { setNbId(ids.nbId); setSecId(ids.secId); setNoteId(ids.noteId); }
    // link direto #p=<id> (aberto em nova aba): vai para aquela página
    const hm = (location.hash || "").match(/#p=([A-Za-z0-9_-]+)/);
    if (hm) {
      (metaRef.current?.notebooks || []).forEach((nb) => nb.sections.forEach((s) => {
        if (s.notes.some((n) => n.id === hm[1])) { setNbId(nb.id); setSecId(s.id); setNoteId(hm[1]); }
      }));
    }
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
    if (!noteId) { setBody(null); setBodyFor(null); return; }
    let b = loadBody(noteId) || { content: "", transcript: "", structured: null };
    // blocos que entraram no modelo depois aparecem também em páginas de FUP
    // já criadas (só as ainda não concluídas)
    const m = metaRef.current;
    if (m && b.blocks) {
      let nm = null;
      m.notebooks.forEach((nb) => nb.sections.forEach((s) => s.notes.forEach((n) => { if (n.id === noteId) nm = n; })));
      const tpl = nm && !nm.concluded && nm.templateId ? (m.templates || []).find((t) => t.id === nm.templateId) : null;
      if (tpl && tpl.v === 2) {
        let blocks = b.blocks;
        if (/inbound/i.test(tpl.name || "")) {
          blocks = upgradeLeads(upgradeReunioes(blocks));
          if (!blocks.some((x) => x.type === "consolidado")) blocks = [CONSOLIDADO_BLOCK(), ...blocks];
        }
        if (/farming/i.test(tpl.name || "")) {
          blocks = upgradeVisitas(blocks);
          if (!blocks.some((x) => x.type === "consolidado")) blocks = [CONSOLIDADO_FARMING_BLOCK(), ...blocks];
        }
        if (/parceria/i.test(tpl.name || "")) {
          blocks = upgradeLive(blocks);
          if (!blocks.some((x) => x.type === "consolidado")) blocks = [CONSOLIDADO_PARCERIAS_BLOCK(), ...blocks];
        }
        if (/outbound/i.test(tpl.name || "")) {
          if (!blocks.some((x) => x.type === "consolidado")) blocks = [CONSOLIDADO_OUTBOUND_BLOCK(), ...blocks];
        }
        // campo de resumo da reunião foi aposentado (07/08/2026) — some das páginas antigas
        if (blocks.some((x) => /RESUMO DA REUNIÃO/i.test(x.title || "")))
          blocks = blocks.filter((x) => !/RESUMO DA REUNIÃO/i.test(x.title || ""));
        const missing = (tpl.blocksDef || []).filter((tb) => !blocks.some((x) => x.title === tb.title));
        if (missing.length || blocks !== b.blocks) {
          b = { ...b, blocks: [...blocks, ...missing.map((tb) => ({ ...JSON.parse(JSON.stringify(tb)), id: uid() }))] };
          saveBody(noteId, b);
        }
      }
    }
    setBody(b);
    setBodyFor(noteId);
  }, [noteId, cloudPhase, restoreTick]); // eslint-disable-line

  const patchBody = (patch) => {
    setBody((b) => {
      const p = typeof patch === "function" ? patch(b) : patch;
      const next = { ...b, ...p };
      saveBody(noteId, next);
      return next;
    });
  };

  /* ---------- imagens da página (arquivos em /planner-imagens no OneDrive) ---------- */
  const [imgBusy, setImgBusy] = useState(0);

  const addImageToNote = async (file) => {
    const nId = noteIdRef.current;
    if (!nId) return;
    setImgBusy((v) => v + 1);
    try {
      const { blob, ext, type } = await prepareImage(file);
      const id = uid();
      await ensureFolder("planner-imagens");
      await uploadBinaryFile(`/planner-imagens/${id}.${ext}`, blob, type);
      if (noteIdRef.current === nId) {
        patchBody((b) => ({ images: [...((b && b.images) || []), { id, ext, w: 55 }] }));
      } else {
        const b = loadBody(nId) || { content: "", transcript: "", structured: null };
        saveBody(nId, { ...b, images: [...(b.images || []), { id, ext, w: 55 }] });
      }
    } catch (e) {
      window.alert("Não consegui enviar a imagem — verifique a internet e tente de novo.");
    }
    setImgBusy((v) => v - 1);
  };

  const removeImageFromNote = (id) => {
    const im = ((body && body.images) || []).find((x) => x.id === id);
    patchBody((b) => ({ images: (b.images || []).filter((x) => x.id !== id) }));
    if (im) deleteFile(imgPath(im)).catch(() => {});
  };

  /* ---------- arquivos anexados (em /planner-arquivos no OneDrive) ---------- */
  const [fileBusy, setFileBusy] = useState(0);

  const addFileToNote = async (file) => {
    const nId = noteIdRef.current;
    if (!nId || !file) return;
    if (file.size > 50 * 1024 * 1024) { window.alert(`"${file.name}" é muito grande — o limite é 50 MB.`); return; }
    setFileBusy((v) => v + 1);
    try {
      const id = uid();
      const name = (file.name || "arquivo").normalize("NFC")
        .replace(/[^\wÀ-ÿ.\-]+/g, "-").replace(/-{2,}/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 80) || "arquivo";
      const ref = { id, name, size: file.size };
      await ensureFolder("planner-arquivos");
      if (file.size <= 4 * 1024 * 1024) await uploadBinaryFile(filePath(ref), file, file.type || "application/octet-stream");
      else await uploadLargeFile(filePath(ref), file);
      if (noteIdRef.current === nId) {
        patchBody((b) => ({ files: [...((b && b.files) || []), ref] }));
      } else {
        const b = loadBody(nId) || { content: "", transcript: "", structured: null };
        saveBody(nId, { ...b, files: [...(b.files || []), ref] });
      }
    } catch (e) {
      window.alert("Não consegui enviar o arquivo — verifique a internet e tente de novo.");
    }
    setFileBusy((v) => v - 1);
  };

  const openFileFromNote = async (f) => {
    try {
      const url = await getDownloadUrl(filePath(f));
      if (url) window.open(url, "_blank");
      else window.alert("Arquivo não encontrado no OneDrive — pode ter sido movido ou apagado.");
    } catch (e) {
      window.alert("Não consegui abrir o arquivo — verifique a internet.");
    }
  };

  /* ---------- gravação de reunião: áudio + transcrição + resumo ---------- */
  const [recBusy, setRecBusy] = useState(false);

  const finishRecording = async ({ blob, transcript, noteId: startId }) => {
    // salva sempre na página onde a gravação COMEÇOU, mesmo que o usuário
    // tenha navegado para outra página durante a reunião
    const nId = startId || noteIdRef.current;
    if (!nId) return;
    setRecBusy(true);
    try {
      await ensureFolder("planner-arquivos");
      const dataStr = todayBR().replace(/\//g, "-");
      const novos = [];
      if (blob && blob.size) {
        const aRef = { id: uid(), name: `reuniao-${dataStr}-audio.webm`, size: blob.size };
        if (blob.size <= 4 * 1024 * 1024) await uploadBinaryFile(filePath(aRef), blob, blob.type || "audio/webm");
        else await uploadLargeFile(filePath(aRef), blob);
        novos.push(aRef);
      }
      if (transcript) {
        const tBlob = new Blob([transcript], { type: "text/plain" });
        const tRef = { id: uid(), name: `reuniao-${dataStr}-transcricao.txt`, size: tBlob.size };
        await uploadBinaryFile(filePath(tRef), tBlob, "text/plain");
        novos.push(tRef);
      }
      // sem resumo automático — a pedido do Gui (07/08/2026), a gravação
      // guarda só o áudio e a transcrição como anexos da página
      const aplicar = (b) => ({
        transcript: [b.transcript, transcript].filter(Boolean).join("\n\n"),
        files: [...((b && b.files) || []), ...novos],
      });
      if (noteIdRef.current === nId) patchBody(aplicar);
      else {
        const b = loadBody(nId) || { content: "", transcript: "", structured: null };
        saveBody(nId, { ...b, ...aplicar(b) });
      }
    } catch (e) {
      window.alert("Não consegui salvar a gravação — verifique a internet. A transcrição pode ter se perdido.");
    }
    setRecBusy(false);
  };

  const removeFileFromNote = (id) => {
    const f = ((body && body.files) || []).find((x) => x.id === id);
    patchBody((b) => ({ files: (b.files || []).filter((x) => x.id !== id) }));
    if (f) deleteFile(filePath(f)).catch(() => {});
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
  /* ---------- consolidado do mês (Inbound): soma todos os FUPs do mês ---------- */
  const mesDe = (dataBR) => (dataBR || "").slice(3); // "DD/MM/AAAA" → "MM/AAAA"

  const computeConsolidado = (tplId, mes, curId, curBlocks) => {
    const m = metaRef.current;
    const num = (s) => { const mm = String(s || "").replace(",", ".").match(/[\d.]+/); return mm ? parseFloat(mm[0]) : 0; };
    const acc = { reunioes: 0, leadsIn: 0, leadsRem: 0, aprovados: 0, ressalvados: 0, reprovados: 0, callsClientes: 0, novosParceiros: 0, visitas: 0, callsPipe: 0 };
    m.notebooks.forEach((nb) => nb.sections.forEach((s) => s.notes.forEach((n) => {
      if (n.templateId !== tplId) return;
      if ((n.mes || mesDe(n.createdAt)) !== mes) return;
      const blocks = n.id === curId ? curBlocks : (loadBody(n.id) || {}).blocks;
      (blocks || []).forEach((b) => {
        if (b.type === "reunioes") acc.reunioes += num(b.realizadas);
        if (b.type === "leads") { acc.leadsIn += num(b.inbound); acc.leadsRem += num(b.remarketing); }
        if (b.type === "metric") {
          if (/REALIZADAS|REUNIÕES DA SEMANA/i.test(b.title || "")) acc.reunioes += num(b.value);
          else if (/LEADS INBOUND/i.test(b.title || "")) acc.leadsIn += num(b.value);
          else if (/REMARKETING/i.test(b.title || "")) acc.leadsRem += num(b.value);
        }
        if (b.type === "sql") {
          acc.aprovados += (b.aprovados || []).reduce((a, r) => a + num(r[1]), 0);
          acc.ressalvados += (b.ressalvados || []).reduce((a, r) => a + num(r[1]), 0);
          acc.reprovados += (b.reprovados || []).reduce((a, r) => a + num(r[1]), 0);
        }
        // Parcerias: conta as linhas preenchidas de calls com clientes e novos parceiros
        if (b.type === "table" && /CALLS REALIZADAS COM CLIENTES/i.test(b.title || ""))
          acc.callsClientes += (b.rows || []).filter((r) => (r || []).some((c) => String(c || "").trim())).length;
        if (b.type === "list" && /NOVOS PARCEIROS/i.test(b.title || ""))
          acc.novosParceiros += (b.rows || []).filter((r) => String(r || "").trim()).length;
        // Farming: conta visitas realizadas e calls de pipe realizadas
        if (b.type === "list" && /VISITAS REALIZADAS/i.test(b.title || ""))
          acc.visitas += (b.rows || []).filter((r) => String(r || "").trim()).length;
        if (b.type === "table" && /CALLS DE PIPE REALIZADAS/i.test(b.title || ""))
          acc.callsPipe += (b.rows || []).filter((r) => (r || []).some((c) => String(c || "").trim())).length;
      });
    })));
    Object.keys(acc).forEach((k) => { acc[k] = Math.round(acc[k] * 10) / 10; });
    return acc;
  };

  useEffect(() => {
    // bodyFor !== noteId: o corpo carregado ainda é o da página anterior
    // (acontece ao trocar de tema/aba) — não mexer para não corromper nada
    if (!body || !body.blocks || !noteMeta || bodyFor !== noteId) return;
    const ci = body.blocks.findIndex((x) => x.type === "consolidado");
    if (ci < 0) return;
    const mes = noteMeta.mes || mesDe(noteMeta.createdAt);
    const vals = computeConsolidado(noteMeta.templateId, mes, noteMeta.id, body.blocks);
    const cur = body.blocks[ci];
    if (cur.mes === mes && JSON.stringify(cur.vals) === JSON.stringify(vals)) return;
    patchBody((b) => (b && b.blocks
      ? { blocks: b.blocks.map((x, i) => (i === ci ? { ...x, mes, vals } : x)) }
      : {}));
  }, [body && body.blocks, noteMeta && noteMeta.mes, noteId, bodyFor, cloudPhase]); // eslint-disable-line

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

  /* Reordenar abas arrastando: solta a aba em cima de outra e ela assume aquele lugar */
  const reorderNotebooks = (fromId, toId) => {
    setMeta((m) => {
      const arr = [...m.notebooks];
      const fi = arr.findIndex((x) => x.id === fromId);
      const ti = arr.findIndex((x) => x.id === toId);
      if (fi < 0 || ti < 0 || fi === ti) return m;
      const [moved] = arr.splice(fi, 1);
      arr.splice(ti, 0, moved);
      return { ...m, notebooks: arr };
    });
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

  /* Excluir aba/subtema: todas as páginas vão para a lixeira e uma lápide
     em meta.zapped impede que a sincronização traga a estrutura de volta. */
  const noteToTrash = (nb, s, n, m) => ({
    ...n, nbId: nb.id, secId: s.id, nbName: nb.name, secName: s.name,
    deletedAt: todayBR(), tasks: (m.tasks || []).filter((t) => t.noteId === n.id),
  });

  const deleteNotebook = (id) => {
    const nb = meta.notebooks.find((x) => x.id === id);
    if (!nb || nb.daily) return;
    const nPag = nb.sections.reduce((a, s) => a + s.notes.length, 0);
    if (!window.confirm(`Excluir a aba "${nb.name}"?` + (nPag ? ` As ${nPag} página(s) dela vão para a lixeira (30 dias).` : ""))) return;
    setMeta((m) => {
      const cur = m.notebooks.find((x) => x.id === id);
      if (!cur) return m;
      const entries = [];
      cur.sections.forEach((s) => s.notes.forEach((n) => entries.push(noteToTrash(cur, s, n, m))));
      const ids = new Set(entries.map((e) => e.id));
      return {
        ...m,
        trash: [...entries, ...(m.trash || [])],
        tasks: (m.tasks || []).filter((t) => !ids.has(t.noteId)),
        notebooks: m.notebooks.filter((x) => x.id !== id),
        zapped: [...(m.zapped || []), { id, at: todayBR() }, ...cur.sections.map((s) => ({ id: s.id, at: todayBR() }))],
      };
    });
    if (notebook?.id === id) { setNbId(null); setSecId(null); setNoteId(null); }
  };

  const deleteSection = (id) => {
    const s = notebook?.sections.find((x) => x.id === id);
    if (!s) return;
    if (notebook.sections.length <= 1) { window.alert("Esta é a única seção da aba — para removê-la, exclua a aba inteira."); return; }
    if (!window.confirm(`Excluir o subtema "${s.name}"?` + (s.notes.length ? ` As ${s.notes.length} página(s) dele vão para a lixeira (30 dias).` : ""))) return;
    setMeta((m) => {
      const nb = m.notebooks.find((x) => x.id === notebook.id);
      const cur = nb && nb.sections.find((x) => x.id === id);
      if (!cur) return m;
      const entries = cur.notes.map((n) => noteToTrash(nb, cur, n, m));
      const ids = new Set(entries.map((e) => e.id));
      return {
        ...m,
        trash: [...entries, ...(m.trash || [])],
        tasks: (m.tasks || []).filter((t) => !ids.has(t.noteId)),
        notebooks: m.notebooks.map((x) => x.id !== nb.id ? x : { ...x, sections: x.sections.filter((y) => y.id !== id) }),
        zapped: [...(m.zapped || []), { id, at: todayBR() }],
      };
    });
    if (section?.id === id) { setSecId(null); setNoteId(null); }
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
        // destino sumiu: cai na 1ª seção da mesma aba, senão na 1ª aba comum
        const destNb = m.notebooks.find((nb) => nb.id === tnb) || m.notebooks.find((nb) => !nb.daily) || m.notebooks[0];
        notebooks = notebooks.map((nb) => nb.id !== destNb.id ? nb : {
          ...nb,
          sections: nb.sections.map((s, j) => j !== 0 ? s : { ...s, notes: [nMeta, ...s.notes] }),
        });
      }
      return { ...m, notebooks, tasks: [...(m.tasks || []), ...(ttasks || [])], trash: m.trash.filter((t) => t.id !== id) };
    });
  };

  const purgeAttachments = (id) => {
    const b = loadBody(id);
    ((b && b.images) || []).forEach((im) => { deleteFile(imgPath(im)).catch(() => {}); });
    ((b && b.files) || []).forEach((f) => { deleteFile(filePath(f)).catch(() => {}); });
  };

  const purgeNote = (id) => {
    purgeAttachments(id);
    deleteBodyKey(id);
    setMeta((m) => ({ ...m, trash: (m.trash || []).filter((t) => t.id !== id) }));
  };

  const emptyTrash = () => {
    (metaRef.current?.trash || []).forEach((t) => {
      purgeAttachments(t.id);
      deleteBodyKey(t.id);
    });
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

  /* endereço da página no navegador acompanha a página aberta (permite copiar o link) */
  useEffect(() => {
    if (phase !== "ready") return;
    history.replaceState(null, "", location.pathname + location.search + (noteId ? "#p=" + noteId : ""));
  }, [noteId, phase]);

  /* ---------- abas internas: páginas OU áreas abertas dentro do app ----------
     Cada item é {t: "note"|"nb", id}; entradas antigas (só o id) viram "note". */
  const [tabs, setTabs] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("planner-tabs-v1")) || [];
      return raw.map((x) => (typeof x === "string" ? { t: "note", id: x } : x)).filter((x) => x && x.id);
    } catch (e) { return []; }
  });
  useEffect(() => { try { localStorage.setItem("planner-tabs-v1", JSON.stringify(tabs)); } catch (e) {} }, [tabs]);

  const pickNotebook = (id) => {
    const nb = (metaRef.current || meta).notebooks.find((n) => n.id === id);
    if (!nb) return;
    const s0 = nb.sections[0] || null;
    setNbId(id);
    setSecId(s0 ? s0.id : null);
    setNoteId(s0 && s0.notes.length ? s0.notes[0].id : null);
    setView("editor");
  };

  const openInTab = (nId) => {
    setTabs((ts) => (ts.some((x) => x.t === "note" && x.id === nId) ? ts : [...ts, { t: "note", id: nId }]));
    goToNote(nId);
  };
  const openNbInTab = (id) => {
    setTabs((ts) => (ts.some((x) => x.t === "nb" && x.id === id) ? ts : [...ts, { t: "nb", id }]));
    pickNotebook(id);
  };
  const closeTab = (tab) => setTabs((ts) => ts.filter((x) => !(x.t === tab.t && x.id === tab.id)));

  const tabsInfo = useMemo(() => {
    if (!meta) return [];
    const out = [];
    tabs.forEach((tb) => {
      if (tb.t === "nb") {
        const nb = meta.notebooks.find((n) => n.id === tb.id);
        if (nb) out.push({ t: "nb", id: tb.id, label: nb.name });
      } else {
        meta.notebooks.forEach((nb) => nb.sections.forEach((s) => s.notes.forEach((n) => {
          if (n.id === tb.id) out.push({ t: "note", id: tb.id, label: n.title || "Página sem nome" });
        })));
      }
    });
    return out;
  }, [tabs, meta]);

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

  /* ---------- templates de atas semanais (FUP) ---------- */
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

  useEffect(() => {
    setPrevBlocks(null);
    if (!noteMeta || !noteMeta.templateId) return;
    const p = prevOfTemplate(noteMeta);
    if (!p) return;
    const pb = loadBody(p.id);
    if (pb && pb.blocks) setPrevBlocks(pb.blocks);
  }, [noteId, cloudPhase, meta && meta.notebooks]); // eslint-disable-line

  const createFromTemplate = (tpl, dateBR) => {
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
      const pb = loadBody(prev.id);
      if (tpl.v === 2 && pb && pb.blocks) {
        blocks = JSON.parse(JSON.stringify(pb.blocks));
        if (/inbound/i.test(tpl.name || "")) {
          blocks = upgradeLeads(upgradeReunioes(blocks));
          if (!blocks.some((b) => b.type === "consolidado")) blocks = [CONSOLIDADO_BLOCK(), ...blocks];
        }
        if (/farming/i.test(tpl.name || "")) {
          blocks = upgradeVisitas(blocks);
          if (!blocks.some((b) => b.type === "consolidado")) blocks = [CONSOLIDADO_FARMING_BLOCK(), ...blocks];
        }
        if (/parceria/i.test(tpl.name || "")) {
          blocks = upgradeLive(blocks);
          if (!blocks.some((b) => b.type === "consolidado")) blocks = [CONSOLIDADO_PARCERIAS_BLOCK(), ...blocks];
        }
        if (/outbound/i.test(tpl.name || "")) {
          if (!blocks.some((b) => b.type === "consolidado")) blocks = [CONSOLIDADO_OUTBOUND_BLOCK(), ...blocks];
        }
        // blocos que entraram no modelo depois também aparecem na página clonada
        (tpl.blocksDef || []).forEach((tb) => {
          if (!blocks.some((b) => b.title === tb.title)) blocks.push({ ...JSON.parse(JSON.stringify(tb)), id: uid() });
        });
        // FUP Murilo e transcrição são de cada semana — começam em branco;
        // resumo de gravação foi aposentado
        blocks = blocks
          .filter((b) => !/RESUMO DA REUNIÃO/i.test(b.title || ""))
          .map((b) => (b.type === "fup" ? { ...b, date: "", text: "", comment: "" }
            : b.type === "transcricao" ? { ...b, text: "" } : b));
      }
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
    saveBody(n.id, { content: blocks ? "" : content, transcript: "", structured: null, blocks: blocks || undefined });
    setNoteId(n.id); setView("editor"); setShowTpl(false); setShowSide(false);
  };

  const addTemplate = (name, skeleton) =>
    setMeta((m) => ({ ...m, templates: [...(m.templates || []), { id: uid(), name, skeleton }] }));
  const removeTemplate = (id) =>
    setMeta((m) => ({ ...m, templates: (m.templates || []).filter((t) => t.id !== id) }));

  /* ---------- gerar ata (fila de IA ou chave própria) ---------- */
  const applyAta = (nId, parsed) => {
    const m = metaRef.current;
    let loc = null;
    m.notebooks.forEach((nb) => nb.sections.forEach((s) => s.notes.forEach((n) => {
      if (n.id === nId) loc = { nb, s, n };
    })));
    if (!loc || !parsed || !parsed.titulo) {
      setMeta((mm) => ({ ...mm, iaQueue: (mm.iaQueue || []).filter((q) => q.noteId !== nId) }));
      return;
    }
    const b = loadBody(nId) || { content: "", transcript: "", structured: null };
    const newTasks = (parsed.acoes || [])
      .map((a) => ({ a, u: m.users.find((x) => x.name === a.responsavel) || null }))
      .filter(({ u }) => !!u) // só vira tarefa se houver responsável delegado
      .map(({ a, u }) => ({
        id: uid(), noteId: nId, noteTitle: parsed.titulo || loc.n.title, nbName: loc.nb.name,
        text: a.tarefa, userId: u.id, userName: u.name,
        date: a.prazo || null, done: false, important: !!a.importante, origin: "ia",
      }));
    const nextBody = { ...b, structured: parsed };
    saveBody(nId, nextBody);
    if (noteIdRef.current === nId) setBody(nextBody);
    setIaErr((e) => { const { [nId]: _drop, ...rest } = e; return rest; });
    setMeta((mm) => ({
      ...mm,
      iaQueue: (mm.iaQueue || []).filter((q) => q.noteId !== nId),
      tasks: [...(mm.tasks || []).filter((t) => t.noteId !== nId), ...newTasks],
      notebooks: mm.notebooks.map((nb) => nb.id !== loc.nb.id ? nb : {
        ...nb,
        sections: nb.sections.map((s) => s.id !== loc.s.id ? s : {
          ...s,
          notes: s.notes.map((n) => (n.id !== nId ? n : { ...n, concluded: true, title: parsed.titulo || n.title })),
        }),
      }),
    }));
  };

  /* Ata gerada LOCALMENTE — as atas seguem sempre o mesmo padrão, então o
     próprio app monta tudo dos blocos: instantâneo, custo zero, sem IA. */
  const concludeAta = () => {
    if (!noteMeta || !body) return;
    const tplName = noteMeta.templateId
      ? (((meta.templates || []).find((t) => t.id === noteMeta.templateId) || {}).name || null)
      : null;
    const parsed = gerarAtaLocal({ noteMeta, body, users: meta.users, prevBlocks, tplName });
    applyAta(noteId, parsed);
  };

  /* polling da fila: a cada 10s procura respostas da IA no OneDrive */
  useEffect(() => {
    if (phase !== "ready") return;
    const t = setInterval(async () => {
      const q = metaRef.current?.iaQueue || [];
      if (!q.length) return;
      for (const item of q) {
        // resumo de reunião pode chegar dias depois (PC desligado na hora);
        // os demais tipos expiram em 30 minutos
        const limite = item.tipo === "resumo-reuniao" ? 7 * 24 * 60 * 60 * 1000 : 30 * 60 * 1000;
        if (Date.now() - (item.criadoEm || 0) > limite) {
          setMeta((m) => ({ ...m, iaQueue: (m.iaQueue || []).filter((x) => x.id !== item.id) }));
          const aviso = "A fila da IA não respondeu em 30 minutos — confira se a tarefa \"Planner Fila IA\" está ativa no computador e tente de novo.";
          if (item.tipo === "resumo") setMeta((m) => ({ ...m, weeklyResumo: { text: aviso, em: Date.now() } }));
          else if (item.tipo === "acervo") setMeta((m) => ({ ...m, acervoResposta: { pergunta: item.pergunta || "", texto: aviso, em: Date.now() } }));
          else if (item.tipo === "resumo-reuniao") { /* o resumo local já está na ata — segue sem alarde */ }
          else setIaErr((e) => ({ ...e, [item.noteId]: aviso }));
          continue;
        }
        try {
          const parsed = await pollResponse(item.id);
          if (!parsed) continue;
          if (item.tipo === "resumo") {
            setMeta((m) => ({
              ...m,
              iaQueue: (m.iaQueue || []).filter((x) => x.id !== item.id),
              weeklyResumo: { text: parsed.texto || "", em: Date.now() },
            }));
          } else if (item.tipo === "acervo") {
            setMeta((m) => ({
              ...m,
              iaQueue: (m.iaQueue || []).filter((x) => x.id !== item.id),
              acervoResposta: { pergunta: item.pergunta || "", texto: parsed.texto || "", em: Date.now() },
            }));
          } else if (item.tipo === "resumo-reuniao") {
            // campo de resumo removido (07/08/2026) — só descarta pedidos antigos da fila
            setMeta((m) => ({ ...m, iaQueue: (m.iaQueue || []).filter((x) => x.id !== item.id) }));
          } else {
            applyAta(item.noteId, parsed);
          }
        } catch (e) { /* tenta no próximo ciclo */ }
      }
    }, 10000);
    return () => clearInterval(t);
  }, [phase]); // eslint-disable-line

  const iaState = directBusy && noteId
    ? { status: "gerando" }
    : (meta?.iaQueue || []).some((q) => q.noteId === noteId && q.tipo === "ata")
      ? { status: "fila" }
      : iaErr[noteId]
        ? { status: "erro", msg: iaErr[noteId] }
        : null;

  /* ---------- agenda do Outlook (Microsoft Graph) ---------- */
  const fetchAgenda = async (force) => {
    if (agendaLoadingRef.current) return;
    const cur = agendaRef.current;
    if (!force && Date.now() - cur.fetchedAt < 15 * 60 * 1000 && cur.events.length) return;
    agendaLoadingRef.current = true;
    setAgendaLoading(true); setAgendaErr(null);
    try {
      const teamEmails = (metaRef.current?.users || []).map((u) => (u.email || "").toLowerCase()).filter(Boolean);
      const events = await fetchCalendarEvents(teamEmails);
      const next = { fetchedAt: Date.now(), events };
      setAgenda(next);
      try { localStorage.setItem("planner-agenda-cache", JSON.stringify(next)); } catch (e) {}
    } catch (e) {
      setAgendaErr(`Não consegui acessar sua agenda (${(e && e.message) || "erro desconhecido"}). Toque em atualizar para tentar de novo.`);
    }
    agendaLoadingRef.current = false;
    setAgendaLoading(false);
  };

  useEffect(() => {
    if (phase !== "ready") return;
    try {
      const cache = JSON.parse(localStorage.getItem("planner-agenda-cache") || "null");
      if (cache && cache.events) setAgenda(cache);
    } catch (e) {}
    fetchAgenda(false);
  }, [phase]); // eslint-disable-line

  /* ---------- relatório diário / WhatsApp ---------- */
  const reportForUser = (u, tasksAll, withMeetings) => {
    const tKey = dateKeyBR(todayBR());
    const due = (t) => !t.done && (!t.date || dateKeyBR(t.date) <= tKey);
    const fmt = (t) => `• ${t.important ? "⭐ " : ""}${t.text} ${t.date ? `(${t.date})` : "(sem prazo)"}${t.date && dateKeyBR(t.date) < tKey ? " ⚠️" : ""}`;
    const list = tasksAll.filter((t) => t.userId === u.id && due(t))
      .sort((a, b) => (dateKeyBR(a.date) || "99999999").localeCompare(dateKeyBR(b.date) || "99999999"));
    let txt = `*📋 BOM DIA, ${u.name.split(" ")[0]}! — ${todayBR()}*\n`;
    const localDay = isoToday();
    const events = agendaRef.current.events || [];
    if (withMeetings) {
      const ms = events.filter((e) => e.inicio.slice(0, 10) === localDay).sort((a, b) => a.inicio.localeCompare(b.inicio));
      txt += `\n*🗓 Reuniões (${ms.length})*\n` + (ms.length ? ms.map((e) => `• ${e.inicio.slice(11, 16)}–${e.fim.slice(11, 16)} ${e.titulo}`).join("\n") : "• sem reuniões") + "\n";
    } else if (u.email) {
      const mine2 = events.filter((e) =>
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

  const waReady = (u) => !!u.phone && !!tmbKey;

  const sendReportToTeam = () => {
    scanAllTasks();
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

  useEffect(() => {
    if (phase !== "ready" || !meta) { setPendingAuto(false); return; }
    if (new Date().getHours() < 7) { setPendingAuto(false); return; }
    if ((meta.autoSend || "") === isoToday()) { setPendingAuto(false); return; }
    setPendingAuto((meta.users || []).length > 0);
  }, [phase, meta]); // eslint-disable-line

  /* Resumo semanal LOCAL: montado na hora das páginas e tarefas — custo zero. */
  const weeklySummary = () => {
    setWeeklyOpen(true);
    const text = resumoSemanalLocal({ meta: metaRef.current, loadBody });
    setMeta((m) => ({ ...m, weeklyResumo: { text, em: Date.now() } }));
  };

  /* ---------- pergunte ao acervo (IA) ---------- */
  const buildAcervoPrompt = (query) => {
    const m = metaRef.current;
    const corpus = [];
    for (const nb of m.notebooks) for (const s of nb.sections) for (const n of s.notes) {
      const b = loadBody(n.id);
      const content = bodyText(b) + " " + ((b && b.structured && JSON.stringify(b.structured)) || "");
      if (content.trim().length > 5) corpus.push(`### [${nb.name} · ${s.name}] ${n.title} (${n.createdAt})\n${content.slice(0, 1500)}`);
      if (corpus.join("").length > 40000) break;
    }
    return `Você é a memória institucional do Planner - Gui - Finamob. Responda à pergunta abaixo APENAS com base nas páginas fornecidas, em português, de forma direta. Cite entre colchetes o título das páginas que fundamentam a resposta. Se não houver informação, diga que não encontrou.

PERGUNTA: ${query}

PÁGINAS:
${corpus.join("\n\n") || "(vazio)"}

Responda SOMENTE com JSON válido, sem markdown, neste formato exato: {"texto":"a resposta aqui"}`;
  };

  const askAcervo = async (query) => {
    if (acervoBusy || (metaRef.current?.iaQueue || []).some((q) => q.tipo === "acervo")) return;
    const prompt = buildAcervoPrompt(query);
    if (getAnthropicKey()) {
      setAcervoBusy(true);
      try {
        const parsed = await callDirect(prompt, TEXT_SCHEMA);
        setMeta((m) => ({ ...m, acervoResposta: { pergunta: query, texto: parsed.texto || "", em: Date.now() } }));
      } catch (e) {
        setMeta((m) => ({ ...m, acervoResposta: { pergunta: query, texto: "Erro ao consultar a IA — tente novamente.", em: Date.now() } }));
      }
      setAcervoBusy(false);
    } else {
      try {
        const id = await enqueueRequest({ tipo: "acervo", noteId: "acervo", prompt });
        setMeta((m) => ({ ...m, iaQueue: [...(m.iaQueue || []), { id, noteId: "acervo", tipo: "acervo", pergunta: query, criadoEm: Date.now() }] }));
      } catch (e) {
        setMeta((m) => ({ ...m, acervoResposta: { pergunta: query, texto: "Não consegui enviar a pergunta para a fila — verifique a internet.", em: Date.now() } }));
      }
    }
  };

  /* ---------- migração: detectar backup do app antigo no OneDrive ---------- */
  useEffect(() => {
    if (cloudPhase !== "pronto" || phase !== "identify") return;
    if ((metaRef.current?.users || []).length > 0) return; // já tem dados de verdade
    if (localStorage.getItem("planner-backup-dismissed")) return;
    (async () => {
      try {
        const b = await readJsonFile("/planner-backup-completo.json");
        if (b && b.meta && b.meta.notebooks) setBackup(b);
      } catch (e) { /* sem backup, segue normal */ }
    })();
  }, [cloudPhase, phase]); // eslint-disable-line

  const importBackup = async () => {
    if (!backup || importing) return;
    setImporting(true); setImportErr(null);
    try {
      await importData({ meta: backup.meta, bodies: backup.bodies || {}, tmbKey: backup.tmbKey || "" });
      window.location.reload();
    } catch (e) {
      setImportErr(`Não consegui importar (${e.message || "erro"}). Tente de novo.`);
      setImporting(false);
    }
  };

  /* ---------- exportar / importar manual ---------- */
  const doImportText = async (text) => {
    try {
      const p = JSON.parse(text);
      await importData(p);
      window.location.reload();
    } catch (e) {
      setXfer((x) => ({ ...x, err: "JSON inválido ou erro ao gravar — copie o texto completo da exportação e cole aqui." }));
    }
  };

  const restoreFromCloudBackup = async () => {
    setXfer((x) => ({ ...x, loading: true, err: null }));
    try {
      const b = await readJsonFile("/planner-backup-completo.json");
      if (!b || !b.meta) throw new Error("backup não encontrado");
      await importData({ meta: b.meta, bodies: b.bodies || {}, tmbKey: b.tmbKey || "" });
      window.location.reload();
    } catch (e) {
      setXfer((x) => ({ ...x, loading: false, err: "Não achei o planner-backup-completo.json no seu OneDrive — cole o pacote manualmente." }));
    }
  };

  /* ---------- atalhos: Ctrl+K busca · Ctrl+Z desfaz · Ctrl+Y / Ctrl+Shift+Z refaz ---------- */
  useEffect(() => {
    const h = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "k") {
        e.preventDefault();
        setView("search");
        setShowSide(false);
      } else if (k === "z") {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      } else if (k === "y" && !e.shiftKey) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [undo, redo]);

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
      <>
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
        {backup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(20,26,38,.75)" }}>
            <div className="w-full max-w-sm rounded-2xl p-6 text-center" style={{ background: "#fff" }}>
              <p className="text-3xl mb-2">📦</p>
              <p className="font-semibold mb-1" style={{ color: "#1F2937" }}>Achei seus dados do app antigo!</p>
              <p className="text-sm mb-4" style={{ color: "#6B7280" }}>
                O backup <b>planner-backup-completo.json</b> está no seu OneDrive
                {backup.backupEm ? ` (de ${new Date(backup.backupEm).toLocaleDateString("pt-BR")})` : ""}.
                Quer trazer tudo para cá — equipe, cadernos, páginas, FUPs e tarefas?
              </p>
              {importErr && <p className="text-xs mb-3" style={{ color: C.danger }}>{importErr}</p>}
              <button onClick={importBackup} disabled={importing}
                className="w-full rounded-lg py-2.5 text-sm font-semibold text-white mb-2 flex items-center justify-center gap-2"
                style={{ background: C.stamp, opacity: importing ? 0.7 : 1 }}>
                {importing ? <><Loader2 size={15} className="animate-spin" /> Importando…</> : "Importar tudo (1 clique)"}
              </button>
              <button onClick={() => { localStorage.setItem("planner-backup-dismissed", "1"); setBackup(null); }}
                className="text-xs underline" style={{ color: "#9CA3AF" }}>
                começar do zero (não perguntar de novo)
              </button>
            </div>
          </div>
        )}
      </>
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
        }} onAdd={addNotebook} onRename={renameNotebook} onDelete={deleteNotebook} onReorder={reorderNotebooks} onOpenTab={openNbInTab} />
        <div className="flex-1" />
        <button onClick={undo} disabled={!canUndo} className="p-2 rounded-lg text-white"
          style={{ background: C.inkSoft, opacity: canUndo ? 1 : 0.35 }} title="Desfazer (Ctrl+Z)">
          <Undo2 size={15} />
        </button>
        <button onClick={redo} disabled={!canRedo} className="p-2 rounded-lg text-white"
          style={{ background: C.inkSoft, opacity: canRedo ? 1 : 0.35 }} title="Refazer (Ctrl+Y)">
          <Redo2 size={15} />
        </button>
        <button onClick={syncNow} className="p-2 rounded-lg text-white" style={{ background: C.inkSoft }} title="Sincronizar com o OneDrive">
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
          className="p-2 rounded-lg text-white" style={{ background: view === "search" ? C.stamp : C.inkSoft }} title="Busca e IA (Ctrl+K)">
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

      {tabsInfo.length > 0 && (
        <div className="flex items-center gap-1 px-2 pt-1.5 overflow-x-auto shrink-0 border-b"
          style={{ background: "#DDE1E6", borderColor: C.line }}>
          {tabsInfo.map((tb) => {
            const active = view === "editor" && (tb.t === "note"
              ? tb.id === noteId
              : notebook?.id === tb.id && !tabsInfo.some((x) => x.t === "note" && x.id === noteId));
            return (
              <div key={tb.t + tb.id}
                onClick={() => { (tb.t === "note" ? goToNote(tb.id) : pickNotebook(tb.id)); setShowSide(false); }}
                className="flex items-center gap-1 pl-3 pr-1.5 py-1.5 rounded-t-lg text-xs cursor-pointer whitespace-nowrap shrink-0"
                style={active
                  ? { background: C.appBg, color: "#1F2937", fontWeight: 600 }
                  : { background: "#EAECEF", color: "#4B5563" }}>
                {tb.t === "nb" && <span>📂</span>}
                <span className="truncate" style={{ maxWidth: 150 }}>{tb.label}</span>
                <button onClick={(e) => { e.stopPropagation(); closeTab(tb); }}
                  className="p-0.5 rounded-full" title="Fechar aba" style={{ color: "#9CA3AF" }}>
                  <X size={11} />
                </button>
              </div>
            );
          })}
        </div>
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
                  {s.id === section?.id && (
                    <span onClick={(e) => { e.stopPropagation(); deleteSection(s.id); }}
                      className="opacity-50 hover:opacity-100" title="Excluir subtema" style={{ color: C.danger }}>
                      <Trash2 size={11} />
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
                  onContextMenu={(e) => { e.preventDefault(); openInTab(n.id); setShowSide(false); }}
                  title="Clique com o botão direito para abrir em uma aba do app"
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
                  <button onClick={(e) => { e.stopPropagation(); openInTab(n.id); setShowSide(false); }}
                    className="opacity-40 group-hover:opacity-100 p-1 shrink-0" title="Abrir em uma aba do app" style={{ color: "#6B7280" }}>
                    <ExternalLink size={13} />
                  </button>
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
            <SearchView meta={meta} loadBody={loadBody} onGo={goToNote}
              acervo={{
                busy: acervoBusy,
                fila: (meta.iaQueue || []).some((x) => x.tipo === "acervo"),
                resposta: meta.acervoResposta || null,
              }}
              onAsk={askAcervo} />
          ) : view === "meetings" ? (
            <MeetingsView agenda={agenda} loading={agendaLoading} err={agendaErr} onRefresh={() => fetchAgenda(true)} />
          ) : view === "report" ? (
            <ReportView agenda={agenda} meta={meta} me={me} loading={agendaLoading || scanning}
              onToggle={toggleTask} onGo={goToNote} onRefresh={() => { fetchAgenda(true); scanAllTasks(); }}
              onSendAll={sendReportToTeam} sendList={sendList} onMarkSent={markSent} onCloseSend={() => setSendList(null)}
              tmbKey={tmbKey} onWeekly={weeklySummary}
              weekly={weeklyOpen ? {
                loading: weeklyBusy,
                fila: (meta.iaQueue || []).some((x) => x.tipo === "resumo"),
                text: meta.weeklyResumo?.text || null,
              } : null}
              onCloseWeekly={() => setWeeklyOpen(false)} />
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
          ) : !body || bodyFor !== noteId ? (
            <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin" color={C.ink} /></div>
          ) : noteMeta.concluded && body.structured ? (
            <AtaDocument body={body} tasks={(meta.tasks || []).filter((t) => t.noteId === noteId)} meta={meta}
              prevBlocks={prevBlocks} onOpenFile={openFileFromNote}
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
              iaState={iaState}
              onImage={addImageToNote} onRemoveImage={removeImageFromNote} imgBusy={imgBusy > 0}
              onFile={addFileToNote} onOpenFile={openFileFromNote} onRemoveFile={removeFileFromNote} fileBusy={fileBusy > 0}
              onRecording={finishRecording} recBusy={recBusy}
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
              <>
                <p className="text-xs mb-2" style={{ color: "#6B7280" }}>
                  Copie o pacote abaixo e guarde ou cole em "Importar dados" em outra instância. Tudo vai junto: cadernos, páginas, atas, tarefas, equipe, modelos e chave.
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
            ) : (
              <>
                <p className="text-xs mb-2" style={{ color: "#6B7280" }}>
                  <b>Atenção:</b> os dados atuais serão substituídos pelos importados. O backup diário
                  "planner-backup-completo.json" do app antigo usa este mesmo formato.
                </p>
                <button onClick={restoreFromCloudBackup} disabled={xfer.loading}
                  className="w-full rounded-lg py-2 text-sm font-medium text-white mb-2 flex items-center justify-center gap-2"
                  style={{ background: "#1F5FA8", opacity: xfer.loading ? 0.7 : 1 }}>
                  {xfer.loading ? <><Loader2 size={14} className="animate-spin" /> Lendo o backup no OneDrive…</> : "🔄 Restaurar do backup OneDrive (app antigo)"}
                </button>
                <p className="text-center text-xs mb-2" style={{ color: "#9CA3AF" }}>— ou cole o pacote manualmente —</p>
                <textarea value={xfer.text} onChange={(e) => setXfer({ ...xfer, text: e.target.value })}
                  placeholder='{"app":"Planner - Gui - Finamob", ...}'
                  className="w-full h-32 border rounded-lg p-2 text-xs outline-none mb-2" style={{ borderColor: C.line, fontFamily: "monospace" }} />
                {xfer.err && <p className="text-xs mb-2" style={{ color: C.danger }}>{xfer.err}</p>}
                <button onClick={() => doImportText(xfer.text)}
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
              Para criar um modelo novo: monte uma página livre com a estrutura desejada e toque em <b>"Salvar como modelo"</b> no editor.
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
          tmbKey={tmbKey} onSaveKey={saveTmbKey}
          anthropicKey={anthropicKey} onSaveAnthropicKey={saveAnthropicKey}
          onExport={() => { setShowTeam(false); setXfer({ mode: "export", text: JSON.stringify(getSnapshot()) }); }}
          onImport={() => { setShowTeam(false); setXfer({ mode: "import", text: "" }); }}
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
function NotebookTabs({ meta, nbId, onPick, onAdd, onRename, onDelete, onReorder, onOpenTab }) {
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState("");
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [dragId, setDragId] = useState(null);

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
            draggable={!nb.daily}
            onDragStart={(e) => { if (nb.daily) return; setDragId(nb.id); e.dataTransfer.effectAllowed = "move"; }}
            onDragOver={(e) => { if (dragId && dragId !== nb.id && !nb.daily) e.preventDefault(); }}
            onDrop={(e) => { e.preventDefault(); if (dragId && dragId !== nb.id && !nb.daily) onReorder(dragId, nb.id); setDragId(null); }}
            onDragEnd={() => setDragId(null)}
            onContextMenu={(e) => { e.preventDefault(); onOpenTab(nb.id); }}
            title={nb.daily ? "Botão direito abre em aba" : "Segure e arraste para reordenar · botão direito abre em aba"}
            className="px-3 py-1.5 rounded-lg text-sm whitespace-nowrap flex items-center gap-1.5"
            style={{
              ...(nb.id === nbId ? { background: "#F5F6F8", color: C.ink, fontWeight: 600 } : { color: "#B8BFCC" }),
              opacity: dragId === nb.id ? 0.4 : 1,
            }}>
            {nb.name}
            {nb.id === nbId && (
              <span onClick={(e) => { e.stopPropagation(); setEditId(nb.id); setEditVal(nb.name); }}
                className="opacity-50 hover:opacity-100" title="Renomear área">
                <Pencil size={11} />
              </span>
            )}
            {nb.id === nbId && !nb.daily && (
              <span onClick={(e) => { e.stopPropagation(); onDelete(nb.id); }}
                className="opacity-50 hover:opacity-100" title="Excluir área" style={{ color: "#E0635C" }}>
                <Trash2 size={11} />
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
