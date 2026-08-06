import { useCallback, useEffect, useRef, useState } from "react";
import { readPlannerData, writePlannerData, writePlannerDataKeepalive } from "./onedrive.js";
import { mergeMeta } from "./lib/data.js";

/* Estado do Planner na nuvem: um único arquivo planner-dados.json no
   OneDrive com {meta, bodies, tmbKey}. Toda gravação faz merge com o
   remoto antes (proteção multi-aparelho); polling a cada 30s. */
export function usePlannerData(prepare) {
  const [cloudPhase, setCloudPhase] = useState("carregando"); // carregando | pronto | erro
  const [cloudErr, setCloudErr] = useState(null);
  const [meta, setMetaState] = useState(null);
  const [saveState, setSaveState] = useState(null); // 'saving' | 'saved' | 'erro'
  const [syncing, setSyncing] = useState(false);
  const [tmbKey, setTmbKeyState] = useState("");
  const [anthropicKey, setAnthropicKeyState] = useState("");

  const metaRef = useRef(null);
  const bodiesRef = useRef({});
  const tmbKeyRef = useRef("");
  const anthropicKeyRef = useRef("");
  const lastSavedRef = useRef("");
  const saveTimer = useRef(null);
  const savingRef = useRef(false);
  const pendingRef = useRef(false);
  const dirtyRef = useRef(false);

  /* ---------- desfazer / refazer (histórico local desta aba) ---------- */
  const undoStack = useRef([]); // [{meta, bodies}] — estado ANTES de cada mudança
  const redoStack = useRef([]);
  const lastEditAt = useRef(0);
  const [histVer, setHistVer] = useState(0); // força re-render dos botões
  const [restoreTick, setRestoreTick] = useState(0); // avisa o app para recarregar a página aberta

  /* Edições contínuas (digitação) num intervalo < 800ms viram um único passo. */
  const recordHistory = () => {
    if (!metaRef.current) return;
    const now = Date.now();
    if (now - lastEditAt.current > 800 || !undoStack.current.length) {
      undoStack.current = [...undoStack.current.slice(-79), { meta: metaRef.current, bodies: bodiesRef.current }];
    }
    if (redoStack.current.length) redoStack.current = [];
    lastEditAt.current = now;
    setHistVer((v) => v + 1);
  };

  const payload = () => ({
    app: "Planner - Gui - Finamob",
    atualizadoEm: new Date().toISOString(),
    meta: metaRef.current,
    bodies: bodiesRef.current,
    tmbKey: tmbKeyRef.current,
    anthropicKey: anthropicKeyRef.current,
  });

  const mergeRemote = (remote) => {
    if (!remote || !remote.meta) return;
    const merged = mergeMeta(metaRef.current, remote.meta);
    bodiesRef.current = { ...(remote.bodies || {}), ...bodiesRef.current };
    metaRef.current = merged;
    setMetaState(merged);
    /* mudanças vindas de outro aparelho/aba não são desfazíveis: zera o
       histórico para o Ctrl+Z nunca apagar o que chegou de fora */
    undoStack.current = [];
    redoStack.current = [];
    setHistVer((v) => v + 1);
  };

  const doSaveRef = useRef(null);

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    setSaveState("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSaveRef.current(), 1500);
  }, []);

  const doSave = useCallback(async () => {
    if (savingRef.current) { pendingRef.current = true; return; }
    savingRef.current = true;
    setSaveState("saving");
    try {
      let remote = null;
      try { remote = await readPlannerData(); } catch (e) { /* segue e tenta gravar */ }
      if (remote && JSON.stringify(remote) !== lastSavedRef.current) mergeRemote(remote);
      const p = payload();
      await writePlannerData(p);
      lastSavedRef.current = JSON.stringify(p);
      setSaveState("saved");
      if (!pendingRef.current) dirtyRef.current = false;
    } catch (e) {
      setSaveState("erro");
    }
    savingRef.current = false;
    if (pendingRef.current) { pendingRef.current = false; scheduleSave(); }
  }, [scheduleSave]);
  doSaveRef.current = doSave;

  /* ---------- API usada pelo app ---------- */
  const setMeta = useCallback((updater) => {
    recordHistory();
    setMetaState((m) => {
      const next = typeof updater === "function" ? updater(m) : updater;
      metaRef.current = next;
      scheduleSave();
      return next;
    });
  }, [scheduleSave]); // eslint-disable-line

  const loadBody = useCallback((id) => bodiesRef.current[id] || null, []);
  const saveBody = useCallback((id, body) => {
    recordHistory();
    bodiesRef.current = { ...bodiesRef.current, [id]: body };
    scheduleSave();
  }, [scheduleSave]); // eslint-disable-line
  const deleteBodyKey = useCallback((id) => {
    recordHistory();
    const { [id]: _drop, ...rest } = bodiesRef.current;
    bodiesRef.current = rest;
    scheduleSave();
  }, [scheduleSave]); // eslint-disable-line

  /* Aplica uma foto do histórico e agenda a gravação normal (com merge). */
  const applySnap = useCallback((snap) => {
    metaRef.current = snap.meta;
    bodiesRef.current = snap.bodies;
    setMetaState(snap.meta);
    lastEditAt.current = 0; // a próxima edição abre um novo passo de desfazer
    setHistVer((v) => v + 1);
    setRestoreTick((t) => t + 1);
    scheduleSave();
  }, [scheduleSave]);

  const undo = useCallback(() => {
    const s = undoStack.current;
    if (!s.length) return;
    const snap = s[s.length - 1];
    undoStack.current = s.slice(0, -1);
    redoStack.current = [...redoStack.current, { meta: metaRef.current, bodies: bodiesRef.current }];
    applySnap(snap);
  }, [applySnap]);

  const redo = useCallback(() => {
    const s = redoStack.current;
    if (!s.length) return;
    const snap = s[s.length - 1];
    redoStack.current = s.slice(0, -1);
    undoStack.current = [...undoStack.current, { meta: metaRef.current, bodies: bodiesRef.current }];
    applySnap(snap);
  }, [applySnap]);
  const saveTmbKey = useCallback((k) => {
    tmbKeyRef.current = k;
    setTmbKeyState(k);
    scheduleSave();
  }, [scheduleSave]);
  const saveAnthropicKey = useCallback((k) => {
    anthropicKeyRef.current = (k || "").trim();
    setAnthropicKeyState(anthropicKeyRef.current);
    scheduleSave();
  }, [scheduleSave]);

  /* ---------- carga inicial ---------- */
  useEffect(() => {
    (async () => {
      try {
        const raw = await readPlannerData();
        const base = {
          app: "Planner - Gui - Finamob",
          meta: (raw && raw.meta) || null,
          bodies: (raw && raw.bodies) || {},
          tmbKey: (raw && raw.tmbKey) || "",
          anthropicKey: (raw && raw.anthropicKey) || "",
        };
        const { data, changed } = prepare(base);
        metaRef.current = data.meta;
        bodiesRef.current = data.bodies || {};
        tmbKeyRef.current = data.tmbKey || "";
        anthropicKeyRef.current = data.anthropicKey || "";
        setMetaState(data.meta);
        setTmbKeyState(data.tmbKey || "");
        setAnthropicKeyState(data.anthropicKey || "");
        lastSavedRef.current = raw ? JSON.stringify(raw) : "";
        if (changed || !raw) {
          const p = payload();
          await writePlannerData(p);
          lastSavedRef.current = JSON.stringify(p);
        }
        setCloudPhase("pronto");
      } catch (e) {
        setCloudErr(e.message || "erro desconhecido");
        setCloudPhase("erro");
      }
    })();
  }, []); // eslint-disable-line

  /* ---------- sincronização periódica (30s) ---------- */
  useEffect(() => {
    if (cloudPhase !== "pronto") return;
    const t = setInterval(async () => {
      if (savingRef.current || dirtyRef.current) return; // edição local ainda não salva: nunca sobrescrever
      try {
        const remote = await readPlannerData();
        if (!remote || !remote.meta) return;
        const rs = JSON.stringify(remote);
        if (rs === lastSavedRef.current) return;
        mergeRemote(remote);
        if (remote.tmbKey && remote.tmbKey !== tmbKeyRef.current) {
          tmbKeyRef.current = remote.tmbKey;
          setTmbKeyState(remote.tmbKey);
        }
        if (remote.anthropicKey && remote.anthropicKey !== anthropicKeyRef.current) {
          anthropicKeyRef.current = remote.anthropicKey;
          setAnthropicKeyState(remote.anthropicKey);
        }
        lastSavedRef.current = rs;
        scheduleSave(); // regrava o resultado do merge
      } catch (e) { /* tenta no próximo ciclo */ }
    }, 30000);
    return () => clearInterval(t);
  }, [cloudPhase, scheduleSave]);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    try { await doSave(); } catch (e) {}
    setSyncing(false);
  }, [doSave]);

  /* ---------- flush ao sair/minimizar ---------- */
  useEffect(() => {
    const flush = () => {
      if (!dirtyRef.current) return;
      clearTimeout(saveTimer.current);
      const p = payload();
      lastSavedRef.current = JSON.stringify(p);
      writePlannerDataKeepalive(p);
      dirtyRef.current = false;
    };
    /* Ao minimizar/trocar de aba a página continua viva: dá para fazer o
       salvamento COMPLETO com merge (nunca sobrescreve outra aba). O flush
       cego via keepalive fica só para o fechamento abrupto (pagehide). */
    const onVis = () => {
      if (document.visibilityState === "hidden" && dirtyRef.current) {
        clearTimeout(saveTimer.current);
        doSaveRef.current();
      }
    };
    window.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, []); // eslint-disable-line

  /* ---------- exportar / importar ---------- */
  const getSnapshot = useCallback(() => ({
    app: "Planner - Gui - Finamob",
    exportadoEm: new Date().toISOString(),
    meta: metaRef.current,
    bodies: bodiesRef.current,
    tmbKey: tmbKeyRef.current,
    anthropicKey: anthropicKeyRef.current,
  }), []);

  /* Substitui TODO o conteúdo pelo pacote importado e regrava na nuvem. */
  const importData = useCallback(async (p) => {
    if (!p || !p.meta || !p.meta.notebooks) throw new Error("formato inválido");
    const data = {
      app: "Planner - Gui - Finamob",
      atualizadoEm: new Date().toISOString(),
      meta: p.meta,
      bodies: p.bodies || {},
      tmbKey: p.tmbKey || tmbKeyRef.current || "",
      anthropicKey: p.anthropicKey || anthropicKeyRef.current || "",
    };
    await writePlannerData(data);
  }, []);

  return {
    cloudPhase, cloudErr, meta, setMeta, metaRef,
    loadBody, saveBody, deleteBodyKey,
    tmbKey, saveTmbKey,
    anthropicKey, saveAnthropicKey,
    saveState, syncing, syncNow,
    getSnapshot, importData,
    undo, redo, restoreTick, histVer,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
  };
}
