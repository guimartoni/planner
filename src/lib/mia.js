import { C, todayBR, uid } from "./util.js";
import { chaveSemana, segundaDa, statusDe } from "./semana.js";

/* Regras das atividades da MIA — compartilhadas pelo painel e pela ata. */

export const SECOES_PADRAO = () => ([
  { id: uid(), nome: "Farejador", atividades: [] },
  { id: uid(), nome: "Inbound + RMKT", atividades: [] },
  { id: uid(), nome: "FinAdvisor", atividades: [] },
]);

/* Seções que entram uma única vez em quem já usava a aba. O carimbo evita que
   elas voltem sozinhas depois de excluídas. */
const NOVAS_SECOES = [{ carimbo: "finadvisor", nome: "FinAdvisor", teste: /fin\s*d?advisor/i }];

/* As atividades que existiam antes do campo de data de cadastro entram com
   01/08 — dali em diante cada uma nasce com a data do dia em que foi criada. */
const CRIACAO_ANTIGA = () => `01/08/${todayBR().slice(6)}`;

const normalizaAtividade = (a) => ({
  id: a.id || uid(),
  atividade: a.atividade || "",
  semana: segundaDa(a.semana || a.data || ""),
  criadaEm: a.criadaEm || CRIACAO_ANTIGA(),
  prioridade: a.prioridade || "media",
  concluida: !!a.concluida,
  concluidaEm: a.concluidaEm || null,
  atrasoManual: !!a.atrasoManual,
  historico: a.historico || [],
});

/* meta.mia começou como uma lista simples de atividades; aqui ela vira o
   formato com seções, sem perder nada (o que fala de Farejador vai para a
   seção do Farejador; o resto para Inbound + RMKT) e com os campos novos
   preenchidos. */
export function normalizaMia(mia) {
  if (mia && !Array.isArray(mia) && Array.isArray(mia.secoes)) {
    const secoes = mia.secoes.map((s) => ({ ...s, atividades: (s.atividades || []).map(normalizaAtividade) }));
    const criadas = [...(mia.secoesCriadas || [])];
    NOVAS_SECOES.forEach((n) => {
      if (criadas.includes(n.carimbo)) return;
      criadas.push(n.carimbo);
      if (!secoes.some((s) => n.teste.test(s.nome || ""))) secoes.push({ id: uid(), nome: n.nome, atividades: [] });
    });
    return { secoes, comentarios: mia.comentarios || "", secoesCriadas: criadas };
  }
  const antigas = Array.isArray(mia) ? mia : [];
  const secoes = SECOES_PADRAO();
  antigas.forEach((a) => {
    const item = normalizaAtividade(a);
    const alvo = /farejador/i.test(item.atividade) ? secoes[0] : secoes[1];
    alvo.atividades.push(item);
  });
  return { secoes, comentarios: (mia && mia.comentarios) || "", secoesCriadas: NOVAS_SECOES.map((n) => n.carimbo) };
}

export const ESTILO = {
  concluido: { rotulo: "✅ Concluído", background: C.stampSoft, color: C.stamp },
  atraso: { rotulo: "⚠️ Atraso", background: "#FCEBEB", color: "#A32D2D" },
  "a-executar": { rotulo: "🕒 A executar", background: "#EEF0F2", color: "#4B5563" },
};

export const PRIORIDADE = {
  alta: { rotulo: "🔴 Alta", background: "#FCEBEB", color: "#A32D2D", peso: 0 },
  media: { rotulo: "🟡 Média", background: "#FBEEDB", color: "#B45309", peso: 1 },
  baixa: { rotulo: "⚪ Baixa", background: "#EEF0F2", color: "#6B7280", peso: 2 },
};
export const prioridadeDe = (a) => (PRIORIDADE[a.prioridade] ? a.prioridade : "media");

/* Atrasadas primeiro, depois por prioridade e por fim pela semana. */
const PESO_STATUS = { atraso: 0, "a-executar": 1, concluido: 2 };
export const ordenar = (lista) => [...lista].sort((x, y) => {
  const s = PESO_STATUS[statusDe(x)] - PESO_STATUS[statusDe(y)];
  if (s) return s;
  const p = PRIORIDADE[prioridadeDe(x)].peso - PRIORIDADE[prioridadeDe(y)].peso;
  return p || chaveSemana(x.semana).localeCompare(chaveSemana(y.semana));
});

/* Todas as atividades, com o nome da seção junto. */
export const todasAtividades = (dados) =>
  dados.secoes.flatMap((s) => s.atividades.map((a) => ({ ...a, secao: s.nome })));

/* Agrupa por semana para o cronograma (o que não tem semana cai no fim). */
export function porSemana(dados) {
  const grupos = [];
  todasAtividades(dados).forEach((a) => {
    const g = grupos.find((x) => x.semana === (a.semana || ""));
    if (g) g.itens.push(a);
    else grupos.push({ semana: a.semana || "", itens: [a] });
  });
  grupos.sort((x, y) => chaveSemana(x.semana).localeCompare(chaveSemana(y.semana)));
  return grupos;
}
