import { dateKeyBR, todayBR } from "./util.js";
import { bodyText, parseDraftTasks } from "./data.js";

/* ------------------------------------------------------------------ */
/* Gerador LOCAL de atas — custo zero, instantâneo, sem IA.            */
/* As atas seguem sempre o mesmo padrão: os números, listas e o        */
/* comparativo saem direto dos blocos preenchidos.                     */
/* ------------------------------------------------------------------ */

const stripEmoji = (s) =>
  String(s || "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();

const num = (s) => { const m = String(s || "").replace(",", ".").match(/[\d.]+/); return m ? parseFloat(m[0]) : 0; };
const fmtN = (n) => String(Math.round(n * 10) / 10).replace(".", ",");

const capList = (arr, max = 14) =>
  arr.length > max ? [...arr.slice(0, max), `e mais ${arr.length - max}`] : arr;

export function gerarAtaLocal({ noteMeta, body, users, prevBlocks, tplName }) {
  const data = noteMeta.createdAt || todayBR();
  const acoes = parseDraftTasks(bodyText(body), users).map((t) => ({
    tarefa: t.text, responsavel: t.user.name, prazo: t.date, importante: t.important,
  }));
  const participantes = (noteMeta.participants || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!participantes.length && noteMeta.author) participantes.push(noteMeta.author);

  /* ---------- página de FUP (blocos estruturados) ---------- */
  if (body.blocks && body.blocks.length) {
    const B = body.blocks;
    const pauta = B.map((b) => stripEmoji(b.title));
    const decisoes = [];
    const stats = [];

    B.forEach((b) => {
      const t = stripEmoji(b.title);
      const obs = b.comment && b.comment.trim() ? ` — obs.: ${b.comment.trim()}` : "";
      if (b.type === "list") {
        const rows = (b.rows || []).filter(Boolean);
        if (rows.length) {
          decisoes.push(`${t} (${rows.length}): ${capList(rows).join(", ")}${obs}`);
          if (/REALIZADAS/i.test(t)) stats.push(`${rows.length} visitas realizadas`);
          else stats.push(`${rows.length} em "${t.toLowerCase()}"`);
        } else {
          decisoes.push(`${t}: sem informações${obs}`);
        }
      }
      if (b.type === "table") {
        const rows = (b.rows || []).filter((r) => (r || []).some(Boolean));
        if (rows.length) {
          const linhas = rows.map((r) => r.filter(Boolean).join(" · "));
          decisoes.push(`${t} (${rows.length}): ${capList(linhas, 12).join("; ")}${obs}`);
          if (/AGENDADAS/i.test(t)) stats.push(`${rows.length} visitas agendadas`);
          else if (/PIPE REALIZADAS/i.test(t)) {
            const ci = (b.cols || []).findIndex((c) => /opera|n[ºo]/i.test(c));
            const ops = ci >= 0 ? rows.reduce((a, r) => a + num(r[ci]), 0) : 0;
            stats.push(`${rows.length} calls de pipe${ops ? ` com ${fmtN(ops)} operações mapeadas` : ""}`);
          } else if (/A APRESENTAR/i.test(t)) {
            const ci = (b.cols || []).findIndex((c) => /volume|valor|\(m\)/i.test(c));
            const vol = ci >= 0 ? rows.reduce((a, r) => a + num(r[ci]), 0) : 0;
            stats.push(`fila SQL a apresentar de ${fmtN(vol)}M em ${rows.length} operação(ões)`);
          }
        } else {
          decisoes.push(`${t}: sem informações${obs}`);
        }
      }
      if (b.type === "metric") {
        if (String(b.value || "").trim()) {
          decisoes.push(`${t}: ${b.value}${obs}`);
          stats.push(`${t.toLowerCase()}: ${b.value}`);
        } else {
          decisoes.push(`${t}: sem informações${obs}`);
        }
      }
      if (b.type === "check") {
        decisoes.push(`${t}: ${b.checked ? "Realizado" : "Não realizado"}${obs}`);
      }
      if (b.type === "sql") {
        const g = (arr) => (arr || []).reduce((a, r) => a + num(r[1]), 0);
        const nomes = (arr) => (arr || []).map((r) => `${r[0]} ${fmtN(num(r[1]))}M`).join(", ");
        const partes = [];
        if ((b.aprovados || []).length) partes.push(`aprovados ${fmtN(g(b.aprovados))}M (${nomes(b.aprovados)})`);
        if ((b.ressalvados || []).length) partes.push(`ressalvados ${fmtN(g(b.ressalvados))}M (${nomes(b.ressalvados)})`);
        if ((b.reprovados || []).length) partes.push(`reprovados ${fmtN(g(b.reprovados))}M (${nomes(b.reprovados)})`);
        if (partes.length) {
          decisoes.push(`${t}${b.comite ? ` (comitê ${b.comite})` : ""}: ${partes.join("; ")}${obs}`);
          stats.push(`comitê com ${partes.join(", ")}`);
        } else {
          decisoes.push(`${t}: sem informações${obs}`);
        }
      }
      if (b.type === "fup") {
        const tt = `${t}${b.date ? ` (${b.date})` : ""}`;
        if ((b.text || "").trim()) {
          (b.text || "").split("\n").map((l) => l.trim()).filter(Boolean).forEach((l) => {
            const semTask = !users.some((u) => l.toLowerCase().includes("@" + u.name.toLowerCase()));
            if (semTask) decisoes.push(`${tt}: ${l.replace(/\*/g, "").trim()}`);
          });
        } else {
          decisoes.push(`${tt}: sem informações${obs}`);
        }
      }
      if (b.type === "text") {
        if ((b.text || "").trim()) {
          (b.text || "").split("\n").map((l) => l.trim()).filter(Boolean).forEach((l) => {
            const semTask = !users.some((u) => l.toLowerCase().includes("@" + u.name.toLowerCase()));
            if (semTask) decisoes.push(`${t}: ${l.replace(/\*/g, "").trim()}`);
          });
        } else {
          decisoes.push(`${t}: sem informações${obs}`);
        }
      }
    });

    const resumo = `${tplName || "FUP semanal"} de ${data}` +
      (participantes.length ? `, com ${participantes.join(", ")}` : "") +
      `. Semana com ${stats.length ? stats.slice(0, 5).join("; ") : "dados registrados nos blocos"}.` +
      (acoes.length ? ` ${acoes.length} ação(ões) delegada(s) à equipe.` : "");

    return {
      titulo: noteMeta.title || `${tplName || "FUP Semanal"} — ${data}`,
      data,
      resumo,
      participantes,
      pauta,
      decisoes,
      comparativo: [],
      acoes,
    };
  }

  /* ---------- página livre (texto corrido) ---------- */
  const linhas = (body.content || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const ehTarefa = (l) => users.some((u) => l.toLowerCase().includes("@" + u.name.toLowerCase()));
  const limpa = (l) => l
    .replace(/📅\s*\d{2}\/\d{2}\/\d{4}/g, "")
    .replace(/\*\*|~~|==|(^|\s)_|_(\s|$)/g, " ")
    .replace(/^[•\-*\s]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  const destaques = linhas.filter((l) => /\*\*|==/.test(l)).map(limpa).filter(Boolean);
  const pauta = linhas.filter((l) => !ehTarefa(l)).map(limpa).filter(Boolean).slice(0, 12);

  const resumo = `Reunião registrada em ${data}` +
    (participantes.length ? ` com ${participantes.join(", ")}` : "") +
    `. ${linhas.length} anotação(ões)` +
    (destaques.length ? `, ${destaques.length} destaque(s)` : "") +
    (acoes.length ? ` e ${acoes.length} ação(ões) delegada(s)` : "") + ".";

  return {
    titulo: noteMeta.title || `Ata de reunião — ${data}`,
    data,
    resumo,
    participantes,
    pauta,
    decisoes: destaques,
    comparativo: [],
    acoes,
  };
}

/* ------------------------------------------------------------------ */
/* Resumo semanal LOCAL — formatado para WhatsApp, custo zero.         */
/* ------------------------------------------------------------------ */
export function resumoSemanalLocal({ meta, loadBody }) {
  const hoje = todayBR();
  const tKey = dateKeyBR(hoje);
  const cut = new Date(); cut.setDate(cut.getDate() - 7);
  const cutKey = dateKeyBR(`${String(cut.getDate()).padStart(2, "0")}/${String(cut.getMonth() + 1).padStart(2, "0")}/${cut.getFullYear()}`);

  const paginas = [];
  (meta.notebooks || []).forEach((nb) => nb.sections.forEach((s) => s.notes.forEach((n) => {
    if (dateKeyBR(n.createdAt) >= cutKey) {
      const b = loadBody(n.id);
      const resumo = b && b.structured && b.structured.resumo ? ` — ${b.structured.resumo.slice(0, 120)}…` : "";
      paginas.push(`• [${nb.name}] ${n.title || "Página sem nome"} (${n.createdAt})${resumo}`);
    }
  })));

  const done = (meta.tasks || []).filter((t) => t.done);
  const abertas = (meta.tasks || []).filter((t) => !t.done && t.userId);
  const atrasadas = abertas.filter((t) => dateKeyBR(t.date) && dateKeyBR(t.date) < tKey);
  const porPessoa = {};
  abertas.forEach((t) => { (porPessoa[t.userName] = porPessoa[t.userName] || []).push(t); });

  let txt = `*📋 RESUMO SEMANAL — ${hoje}*\n`;
  txt += `\n*🗂 Assuntos da semana (${paginas.length})*\n`;
  txt += paginas.length ? paginas.slice(0, 10).join("\n") : "• nenhuma página nova";
  if (paginas.length > 10) txt += `\n• e mais ${paginas.length - 10} página(s)`;

  txt += `\n\n*✅ Concluídas (${done.length})*\n`;
  txt += done.length ? done.slice(-8).map((t) => `• ${t.text} (${t.userName || "?"})`).join("\n") : "• nenhuma concluída registrada";

  txt += `\n\n*⏳ Em aberto por pessoa (${abertas.length})*\n`;
  const nomes = Object.keys(porPessoa);
  txt += nomes.length
    ? nomes.map((n) => `_${n}_ (${porPessoa[n].length})\n` + porPessoa[n].slice(0, 5).map((t) =>
        `• ${t.important ? "⭐ " : ""}${t.text} ${t.date ? `(${t.date})` : "(sem prazo)"}${dateKeyBR(t.date) && dateKeyBR(t.date) < tKey ? " ⚠️" : ""}`
      ).join("\n")).join("\n")
    : "• equipe em dia 👏";

  const focos = [...atrasadas].sort((a, b) => (dateKeyBR(a.date) || "9").localeCompare(dateKeyBR(b.date) || "9")).slice(0, 3);
  if (focos.length) {
    txt += `\n\n*🎯 Focos da próxima semana*\n`;
    txt += focos.map((t) => `• Destravar: ${t.text} (${t.userName}, atrasada desde ${t.date})`).join("\n");
  }
  txt += `\n\n_Planner - Gui - Finamob_`;
  return txt.slice(0, 3500);
}
