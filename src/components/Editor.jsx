import { useMemo, useRef, useState } from "react";
import { FileText, Loader2, Sparkles, Star } from "lucide-react";
import { C } from "../lib/util.js";
import { bodyText, parseDraftTasks } from "../lib/data.js";
import Avatar from "./Avatar.jsx";
import { BlocksEditor } from "./Blocks.jsx";
import FupPanel from "./FupPanel.jsx";
import PageImages from "./PageImages.jsx";
import PageFiles from "./PageFiles.jsx";
import Recorder from "./Recorder.jsx";

export default function Editor({
  noteMeta, body, users, sections, prevBlocks, tplInfo, tplSiblings,
  onGoNote, onSaveTemplate, onTitle, onMeta, onBody, saveState,
  onConclude, iaState, onImage, onRemoveImage, imgBusy,
  onFile, onOpenFile, onRemoveFile, fileBusy,
  onRecording, recBusy,
}) {
  const [tplSaved, setTplSaved] = useState(false);
  const [viewMode, setViewMode] = useState("edit"); // edit | panel
  const taRef = useRef(null);
  const bgRef = useRef(null);
  const fileRef = useRef(null);
  const anexoRef = useRef(null);
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
    if (t.endsWith("\n")) t += "​";
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
    users.forEach((u) => { t = t.replace(new RegExp("@" + escRe(u.name), "gi"), "@" + u.name); });
    sections.forEach((s) => { t = t.replace(new RegExp("!" + escRe(s.name), "gi"), "!" + s.name); });
    t = t.replace(/@([\wÀ-ÿ]+)/g, (full, w, off, str) => {
      const matches = users.filter((u) => u.name.toLowerCase().startsWith(w.toLowerCase()));
      if (matches.length !== 1) return full;
      const cand = matches[0].name;
      const following = str.slice(off + 1, off + 1 + cand.length);
      if (following.toLowerCase() === cand.toLowerCase()) return full;
      return "@" + cand;
    });
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
    // imagem no clipboard (print, cópia de imagem): vira imagem da página
    const items = (e.clipboardData && e.clipboardData.items) || [];
    for (const it of items) {
      if (it.type && it.type.startsWith("image/")) {
        e.preventDefault();
        const f = it.getAsFile();
        if (f && onImage) onImage(f);
        return;
      }
    }
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

  const iaBusy = iaState && (iaState.status === "fila" || iaState.status === "gerando");

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
        {saveState === "saved" && <span style={{ color: C.stamp }}> · salvo na nuvem ✓</span>}
        {saveState === "erro" && <span style={{ color: C.danger }}> · falha ao salvar — verifique a internet</span>}
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
        {body.blocks && (
          <button onClick={() => setViewMode((v) => (v === "panel" ? "edit" : "panel"))}
            className="px-3 py-1.5 rounded-lg text-sm font-medium"
            style={viewMode === "panel" ? { background: C.ink, color: "#fff" } : { background: C.stampSoft, color: C.stamp }}>
            {viewMode === "panel" ? "✏️ Editar" : "📊 Painel"}
          </button>
        )}
        {!tplInfo && !body.blocks && (
          <button onClick={() => { onSaveTemplate(); setTplSaved(true); setTimeout(() => setTplSaved(false), 2000); }}
            className="px-3 py-1.5 rounded-lg text-sm" style={{ color: "#4B5563", background: "#E2E5E9" }} title="Transforma esta estrutura num modelo semanal reutilizável">
            {tplSaved ? "✓ Modelo salvo" : "Salvar como modelo"}
          </button>
        )}
        <Recorder onFinish={onRecording} busy={recBusy} />
        <button onClick={() => anexoRef.current && anexoRef.current.click()}
          className="px-3 py-1.5 rounded-lg text-sm" style={{ color: "#4B5563", background: "#E2E5E9" }}
          title="Anexar arquivo (PDF, planilha etc.) — fica na pasta planner-arquivos do OneDrive">
          📎 Anexar
        </button>
        <input ref={anexoRef} type="file" multiple className="hidden"
          onChange={(e) => {
            [...(e.target.files || [])].forEach((f) => onFile && onFile(f));
            e.target.value = "";
          }} />
        <div className="flex-1" />
        <button onClick={onConclude} disabled={iaBusy}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold text-white"
          style={{ background: C.stamp, opacity: iaBusy ? 0.7 : 1 }}>
          {iaBusy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {iaState?.status === "gerando" ? "Gerando ata…" : iaState?.status === "fila" ? "Na fila da IA…" : "Gerar ata"}
        </button>
      </div>
      {iaState?.status === "fila" && (
        <p className="text-xs mb-2 rounded-lg px-3 py-2" style={{ background: C.stampSoft, color: C.stamp }}>
          ⏳ Pedido na fila da IA — a ata fica pronta em alguns minutos e aparece aqui sozinha. Pode continuar trabalhando ou até fechar o app.
        </p>
      )}
      {iaState?.status === "erro" && <p className="text-xs mb-2" style={{ color: C.danger }}>{iaState.msg}</p>}

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
            <FupPanel blocks={body.blocks} prevBlocks={prevBlocks} />
          </>
        ) : (
          <BlocksEditor
            blocks={body.blocks}
            onChange={(blocks) => onBody({ blocks })}
            users={users} sections={sections} />
        )
      ) : (
        <>
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
            <button title="Adicionar imagem (ou cole com Ctrl+V)"
              onClick={() => fileRef.current && fileRef.current.click()}
              className="w-8 h-8 rounded-lg text-sm border" style={{ borderColor: C.line, background: "#fff" }}>
              📷
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => {
                [...(e.target.files || [])].forEach((f) => onImage && onImage(f));
                e.target.value = "";
              }} />
            <span className="text-xs ml-1" style={{ color: "#B0B5BC" }}>selecione o texto e toque no estilo</span>
          </div>

          <div className="relative rounded-xl border shadow-sm" style={{ borderColor: C.line, background: C.paper }}
            onDragOver={(e) => {
              if ([...(e.dataTransfer?.items || [])].some((i) => i.kind === "file")) e.preventDefault();
            }}
            onDrop={(e) => {
              const fs = [...(e.dataTransfer?.files || [])];
              if (fs.length) {
                e.preventDefault();
                fs.forEach((f) => (f.type.startsWith("image/") ? onImage && onImage(f) : onFile && onFile(f)));
              }
            }}>
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
        </>
      )}

      <PageImages
        images={body.images} busy={imgBusy}
        onResize={(id, w) => onBody((b) => ({ images: (b.images || []).map((im) => (im.id === id ? { ...im, w } : im)) }))}
        onRemove={(id) => onRemoveImage && onRemoveImage(id)} />

      <PageFiles files={body.files} busy={fileBusy}
        onOpen={onOpenFile} onRemove={(id) => onRemoveFile && onRemoveFile(id)} />

      {!body.blocks && body.meetingSummary != null && (
        <div className="mt-3 rounded-xl border shadow-sm" style={{ borderColor: C.line, background: C.paper }}>
          <div className="px-4 pt-3 pb-1.5 border-b" style={{ borderColor: "#EDEDE6" }}>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: C.stamp }}>🎙️ Resumo da reunião</p>
          </div>
          <textarea
            value={body.meetingSummary || ""}
            onChange={(e) => onBody({ meetingSummary: e.target.value })}
            className="w-full p-4 outline-none resize-none bg-transparent text-sm leading-6"
            style={{ color: "#374151", minHeight: 100 }} />
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
