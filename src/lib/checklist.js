/* Checklist de ações da semana.

   A IA devolve só os itens (tarefa/responsável/prazo/prioridade); o texto que
   vai para o WhatsApp é montado aqui, sempre no mesmo formato — assim o recado
   sai igual toda semana e não depende do humor do modelo. */

const linhaDe = (i) =>
  `${i.prioridade === "alta" ? "🔴" : "▫️"} ${i.tarefa}${i.prazo ? ` (🗓 ${i.prazo})` : ""}`;

/* Agrupa por responsável, na ordem em que aparecem; quem não tem dono vai
   para o fim, em "A definir". */
export function agruparPorResponsavel(itens) {
  const grupos = [];
  const semDono = [];
  (itens || []).forEach((i) => {
    if (!i.responsavel) { semDono.push(i); return; }
    const g = grupos.find((x) => x.nome === i.responsavel);
    if (g) g.itens.push(i);
    else grupos.push({ nome: i.responsavel, itens: [i] });
  });
  if (semDono.length) grupos.push({ nome: "A definir", itens: semDono });
  return grupos;
}

export function checklistWhats(chk, { titulo, data } = {}) {
  const itens = (chk && chk.itens) || [];
  if (!itens.length) return "";
  let t = "*✅ CHECKLIST DA SEMANA*\n";
  if (titulo) t += `_${titulo}${data ? ` — ${data}` : ""}_\n`;
  agruparPorResponsavel(itens).forEach((g) => {
    t += `\n*${g.nome}*\n${g.itens.map(linhaDe).join("\n")}\n`;
  });
  return `${t}\n_Planner - Gui - Finamob_`;
}

export function checklistTexto(chk) {
  const itens = (chk && chk.itens) || [];
  if (!itens.length) return "";
  return agruparPorResponsavel(itens)
    .map((g) => `${g.nome}\n${g.itens.map((i) => `- ${i.tarefa}${i.prazo ? ` — prazo ${i.prazo}` : ""}${i.prioridade === "alta" ? " (prioridade alta)" : ""}`).join("\n")}`)
    .join("\n\n");
}
