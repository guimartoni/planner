import { uid } from "./util.js";
import { TRANSCRICAO_BLOCK } from "./blocks.js";

/* FUP semanal de Geração de Demanda (27/10/2026).

   Cada canal (Digital, Remarketing, Outbound, Franquias, Parcerias, Farming,
   Eventos) é um bloco "canal" com a meta semanal de reuniões em Capital e em
   Advisor, o realizado da semana e as ações do plano — cada ação com o produto,
   a diretriz combinada e o custo previsto (por semana ou uma vez no mês).
   Só previsão de custo — gasto real não é controlado aqui (27/10/2026).

   No topo, o bloco "demandaResumo" junta tudo: reuniões da semana e do mês
   contra a meta, custo previsto da semana e a projeção de custo do mês
   (custo semanal × semanas do mês + custos únicos). As reuniões do mês vêm somadas dos FUPs do
   mesmo mês (o Planner preenche b.vals, como no consolidado dos outros FUPs). */

export const PRODUTOS = ["Capital", "Advisor", "Capital + Advisor"];

/* "R$ 2.500,00" / "2500" / "2,5k" → número */
export const reais = (s) => {
  let t = String(s || "").toLowerCase().replace(/r\$|\s/g, "");
  if (!t) return 0;
  const mil = /k$/.test(t);
  t = t.replace(/k$/, "");
  if (/,/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const n = parseFloat(t);
  return isNaN(n) ? 0 : n * (mil ? 1000 : 1);
};
export const qtd = (s) => { const m = String(s || "").replace(",", ".").match(/[\d.]+/); return m ? parseFloat(m[0]) : 0; };
export const fmtR = (n) => "R$ " + Math.round(n || 0).toLocaleString("pt-BR");

const acao = (nome, produto, diretriz, custo = "", periodo = "semana") =>
  ({ id: uid(), nome, produto, diretriz, custo, periodo });
const canal = (title, capital, advisor, acoes, naoAplica = false) => ({
  id: uid(), type: "canal", title,
  meta: { capital: String(capital), advisor: String(advisor) },
  real: { capital: "", advisor: "" },
  naoAplica, acoes, comment: "",
});

export const DEMANDA_RESUMO_BLOCK = () =>
  ({ id: uid(), type: "demandaResumo", title: "📊 PAINEL DA SEMANA — REUNIÕES, CUSTOS E PROJEÇÃO DO MÊS", mes: "", vals: null });

/* Modelo semeado com as diretrizes da primeira reunião de Geração de Demanda */
export const DEMANDA_BLOCKS = () => ([
  DEMANDA_RESUMO_BLOCK(),
  canal("💻 DIGITAL", 20, 20, [
    acao("Campanhas ativas Capital", "Capital", "Calibrar o investimento semanal em R$ 2,5k para gerar ao menos 20 reuniões de inbound. Hoje: CPL = R$ 20,00 e conversão lead → reunião realizada = 15%.", "2.500"),
    acao("Campanhas ativas Advisor", "Advisor", "Ainda sem parâmetros de comparação: iniciar campanha deliberada considerando CPL = R$ 20,00 e taxa de reunião realizada estimada de 15%. Para 20 reuniões por semana: R$ 2.500,00.", "2.500"),
    acao("Campanha Awareness", "Capital + Advisor", "R$ 500,00 por semana no impulsionar + R$ 500,00 no gerador.", "1.000"),
  ]),
  canal("🔁 REMARKETING", 10, 5, [
    acao("Hot — ligações", "", "Ligar para a lista de 250 leads que estão em 1º contato."),
    acao("WhatsApp disparo remarketing Capital", "Capital", "Meta de 10 reuniões, com disparo semanal de 1.000 mensagens.", "500"),
    acao("WhatsApp disparo remarketing Advisor", "Advisor", "Meta de 10 reuniões, com disparo semanal de 1.000 mensagens.", "500"),
    acao("E-mail remarketing Capital", "Capital", "Envio semanal para toda a base (uma semana de engajamento, outra comercial)."),
    acao("E-mail remarketing Advisor", "Advisor", "Ainda sem amostra. Alternar uma semana de engajamento e outra comercial."),
  ]),
  canal("🎯 OUTBOUND", 20, 5, [
    acao("Caccao + IA WhatsApp", "Capital", "Gerar 400 contatos por semana buscando 20 reuniões. Custo: R$ 500,00 da Caccao + R$ 150,00 de WhatsApp.", "650"),
    acao("Caccao + ligação", "Capital", "Ligar para os contatos que não estão respondendo à sequência de mensagens."),
    acao("E-mail outbound", "Capital", "Começar com 30 e-mails por dia para atender a quantidade de contatos gerados na semana."),
    acao("Ligações Advisor", "Advisor", "Meta de 5 reuniões semanais com a base que vamos criar de empresas que são novas incorporadoras."),
    acao("Caccao + WhatsApp Advisor", "Advisor", "Futuramente."),
  ]),
  canal("🏢 FRANQUIAS", 40, 10, [
    acao("Captação local das franquias", "Capital", "Leads a partir de relacionamento local e outbound próprio: 10 reuniões semanais por franquia."),
    acao("Advisor nas franquias", "Advisor", "Fazer uma reunião com as franquias para falar sobre o Advisor."),
  ]),
  canal("🤝 PARCERIAS", 10, 5, [
    acao("Live semanal dos parceiros", "Capital + Advisor", "Fomentar os parceiros a realizar 1 live por semana."),
    acao("WhatsApp remarketing parceiros", "Capital + Advisor", "1 disparo semanal para a base de parceiros sobre produtos, campanhas e incentivos — híbrido entre Capital e Advisor."),
  ]),
  canal("🌾 FARMING", 5, 5, [
    acao("Reuniões presenciais", "Capital + Advisor", "Foco em fomentar liquidações do Capital e vendas do FinAdvisor."),
  ]),
  canal("🎤 EVENTOS", "", "", [
    acao("Esteira de live semanal", "", "Buscar 100 clientes ativos acumulados. Meta do evento: 150 pessoas presentes (mínimo 100)."),
    acao("Venda direta do evento", "", "Iniciar a esteira de venda direta com meta de 25 por semana."),
    acao("Ligações", "", "Pegar a lista das últimas lives e ligar um a um para vender o evento."),
    acao("Disparo WhatsApp lista das lives", "", "Disparo para a lista das lives.", "100"),
    acao("Campanha Instagram", "", "Campanha do evento no Instagram.", "3.000", "mes"),
    acao("Indicação interna", "", "Incentivo da campanha de indicação do evento para todos os incorporadores com quem o time fala."),
  ], true),
  { id: uid(), type: "text", title: "📌 TEMA GERAL / OUTROS ASSUNTOS", text: "" },
  TRANSCRICAO_BLOCK(),
]);

/* Nova semana (clonar a anterior): metas, ações, diretrizes e custos ficam;
   realizado e comentários começam em branco. */
export const limparSemanaDemanda = (b) => {
  if (b.type === "canal") return { ...b, real: { capital: "", advisor: "" }, comment: "" };
  if (b.type === "demandaResumo") return { ...b, mes: "", vals: null };
  return b;
};

/* segundas-feiras do mês da data (DD/MM/AAAA): total e as que vêm depois da semana dela */
export function semanasDoMes(dataBR) {
  const m = (dataBR || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const d = m ? new Date(+m[3], +m[2] - 1, +m[1]) : new Date();
  const ano = d.getFullYear(), mes = d.getMonth();
  const segunda = new Date(d); segunda.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  let total = 0, restantes = 0;
  for (let x = new Date(ano, mes, 1); x.getMonth() === mes; x.setDate(x.getDate() + 1)) {
    if (x.getDay() !== 1) continue;
    total++;
    if (x > segunda) restantes++;
  }
  return { total: total || 4, restantes };
}

/* Acumulados do mês: soma os FUPs do mesmo mês (lista de arrays de blocos).
   Ações e canais são casados pelo id (a semana nova é um clone da anterior). */
export function calcularMesDemanda(paginas, dataBR) {
  const realCanal = {};
  paginas.forEach((blocks) => (blocks || []).forEach((b) => {
    if (b.type !== "canal") return;
    const rc = (realCanal[b.id] = realCanal[b.id] || { capital: 0, advisor: 0 });
    rc.capital += qtd(b.real && b.real.capital);
    rc.advisor += qtd(b.real && b.real.advisor);
  }));
  const s = semanasDoMes(dataBR);
  return { semanasMes: s.total, semanasRestantes: s.restantes, realCanal };
}

/* Projeção de custo de uma ação no mês: custo semanal × semanas do mês, ou o
   custo único quando é "no mês". */
export function projecaoAcao(a, vals) {
  const custo = reais(a.custo);
  return a.periodo === "mes" ? custo : custo * ((vals && vals.semanasMes) || 4);
}

/* Números consolidados da página (semana) + do mês */
export function resumoDemanda(blocks, vals) {
  const canais = (blocks || []).filter((b) => b.type === "canal");
  vals = vals || calcularMesDemanda([blocks], null); // antes do Planner somar o mês: só esta semana
  const sem = vals.semanasMes;
  const r = {
    semana: { metaC: 0, metaA: 0, realC: 0, realA: 0, custo: 0 },
    mes: { metaC: 0, metaA: 0, realC: 0, realA: 0, projecao: 0 },
    canais: [],
  };
  canais.forEach((c) => {
    const rc = (vals.realCanal || {})[c.id] || { capital: qtd(c.real.capital), advisor: qtd(c.real.advisor) };
    const linha = {
      id: c.id, title: c.title, naoAplica: c.naoAplica,
      metaC: c.naoAplica ? 0 : qtd(c.meta.capital), metaA: c.naoAplica ? 0 : qtd(c.meta.advisor),
      realC: qtd(c.real.capital), realA: qtd(c.real.advisor),
      mesRealC: rc.capital, mesRealA: rc.advisor,
      custo: 0, projecao: 0,
    };
    (c.acoes || []).forEach((a) => {
      if (a.periodo !== "mes") linha.custo += reais(a.custo);
      linha.projecao += projecaoAcao(a, vals);
    });
    r.canais.push(linha);
    r.semana.metaC += linha.metaC; r.semana.metaA += linha.metaA;
    r.semana.realC += linha.realC; r.semana.realA += linha.realA;
    r.semana.custo += linha.custo;
    r.mes.metaC += linha.metaC * sem; r.mes.metaA += linha.metaA * sem;
    r.mes.realC += c.naoAplica ? 0 : linha.mesRealC; r.mes.realA += c.naoAplica ? 0 : linha.mesRealA;
    r.mes.projecao += linha.projecao;
  });
  return r;
}

export const pct = (real, meta) => (meta > 0 ? Math.round((real / meta) * 100) : null);

/* texto corrido (busca, IA, ata) */
export function demandaToText(b, blocks) {
  if (b.type === "canal") {
    const meta = b.naoAplica ? "sem meta de reuniões" : `reuniões Capital ${b.real.capital || 0}/${b.meta.capital || 0}, Advisor ${b.real.advisor || 0}/${b.meta.advisor || 0}`;
    const acoes = (b.acoes || []).map((a) => `- ${a.nome}${a.produto ? ` [${a.produto}]` : ""}: ${a.diretriz || ""}${reais(a.custo) ? ` (custo previsto ${fmtR(reais(a.custo))}${a.periodo === "mes" ? " no mês" : "/semana"})` : ""}`);
    const c = resumoDemanda([b], null).canais[0];
    return `${b.title}${c.custo || c.projecao ? ` (custo previsto ${fmtR(c.custo)}/semana · ${fmtR(c.projecao)} no mês)` : ""} — ${meta}\n${acoes.join("\n")}`;
  }
  if (b.type === "demandaResumo") {
    const r = resumoDemanda(blocks, b.vals);
    return `${b.title}${b.mes ? ` (${b.mes})` : ""}: semana — Capital ${r.semana.realC}/${r.semana.metaC}, Advisor ${r.semana.realA}/${r.semana.metaA}; mês — Capital ${r.mes.realC}/${r.mes.metaC}, Advisor ${r.mes.realA}/${r.mes.metaA}; custo previsto da semana ${fmtR(r.semana.custo)}, projeção de custo do mês ${fmtR(r.mes.projecao)}`;
  }
  return "";
}
