import { uid, todayBR } from "./lib/util.js";
import { bodyText } from "./lib/data.js";
import { compareBlocks } from "./lib/blocks.js";
import { readJsonFile, writeJsonFile, deleteFile, ensureFolder } from "./onedrive.js";

/* ------------------------------------------------------------------ */
/* IA de custo zero: os botões de IA gravam um pedido em               */
/* /planner-ia-fila/pedido-<id>.json no OneDrive. Uma tarefa agendada  */
/* do Claude Cowork processa a fila e grava resposta-<id>.json; o app  */
/* fica de olho (polling) e aplica quando a resposta chega.            */
/*                                                                     */
/* Modo opcional: com uma chave da API Anthropic salva no navegador,   */
/* a resposta vem em segundos, direto — sem passar pela fila.          */
/* ------------------------------------------------------------------ */

const FILA = "/planner-ia-fila";
const KEY_STORAGE = "planner-anthropic-key";

/* A chave agora mora nos dados sincronizados (planner-dados.json) e vale
   para todos os aparelhos; o localStorage fica como legado/fallback. */
let runtimeKey = "";
export const setRuntimeAnthropicKey = (k) => { runtimeKey = (k || "").trim(); };
export const getAnthropicKey = () => runtimeKey || localStorage.getItem(KEY_STORAGE) || "";
export const getLegacyLocalKey = () => localStorage.getItem(KEY_STORAGE) || "";

/* ---------- montagem do prompt da ata ---------- */
export function buildAtaPrompt({ noteMeta, body, users, prevBlocks }) {
  const userList = users.map((u) => `${u.name} (${u.area})`).join(", ") || "(nenhum)";
  const partInfo = noteMeta.participants
    ? `Participantes informados pelo usuário (use exatamente estes na lista de participantes): ${noteMeta.participants}.`
    : "Participantes não informados: deduza das anotações/transcrição.";
  let comparativo = "";
  if (body.blocks && prevBlocks) {
    const facts = compareBlocks(prevBlocks, body.blocks);
    if (facts.length) {
      comparativo = `\nFATOS COMPARATIVOS COM A SEMANA ANTERIOR (já calculados — use-os para montar o campo "comparativo", escolhendo os mais relevantes):\n${facts.join("\n")}\n`;
    }
  }
  return `Você estrutura atas de reunião de uma empresa brasileira (Finamob). Data de hoje: ${todayBR()}.
Usuários cadastrados: ${userList}.
${partInfo}

ANOTAÇÕES DA REUNIÃO:
${bodyText(body) || "(vazio)"}

TRANSCRIÇÃO DO ÁUDIO (pode estar vazia; se houver, use-a para complementar):
${body.transcript || "(sem transcrição)"}
${comparativo}
Gere a ata padrão. Responda SOMENTE com JSON válido, sem markdown, sem texto antes ou depois, neste formato exato:
{"titulo":"...","data":"DD/MM/AAAA","resumo":"parágrafo curto resumindo a reunião","participantes":["..."],"pauta":["..."],"decisoes":["..."],"comparativo":["frase curta de evolução vs semana anterior"],"acoes":[{"tarefa":"...","responsavel":"nome exato de usuário cadastrado ou null","prazo":"DD/MM/AAAA ou null","importante":true}]}
Regras: preserve as tarefas marcadas com @ e as datas marcadas com 📅; linhas com asterisco (*) são tarefas importantes (importante:true, e remova o asterisco do texto); demais ações têm importante:false; atribua responsavel apenas se corresponder exatamente a um usuário cadastrado; se não houver comparativo, use lista vazia.`;
}

/* ---------- checklist de ações da semana (fim da ata) ---------- */
export const CHECKLIST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["itens"],
  properties: {
    itens: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tarefa", "responsavel", "prazo", "prioridade"],
        properties: {
          tarefa: { type: "string" },
          responsavel: { type: ["string", "null"] },
          prazo: { type: ["string", "null"] },
          prioridade: { type: "string", enum: ["alta", "normal"] },
        },
      },
    },
  },
};

/* Lê a ata inteira (blocos, decisões, ações já delegadas e a transcrição, se
   houver) e devolve o que precisa ser feito na semana. */
export function buildChecklistPrompt({ noteMeta, body, users, tasks, tplName }) {
  const userList = (users || []).map((u) => `${u.name} (${u.area})`).join(", ") || "(nenhum)";
  const s = body.structured || {};
  const pendentes = (tasks || []).filter((t) => !t.done);
  const transcricao = (body.blocks || [])
    .filter((b) => b.type === "transcricao" && (b.text || "").trim())
    .map((b) => b.text.trim())
    .join("\n\n")
    .slice(0, 20000);
  return `Você organiza o trabalho da semana de uma equipe comercial brasileira (Finamob). Data de hoje: ${todayBR()}.
Equipe cadastrada: ${userList}.
Reunião: ${tplName || noteMeta.title || "FUP semanal"}${noteMeta.createdAt ? ` — ${noteMeta.createdAt}` : ""}.

CONTEÚDO DA ATA:
${bodyText(body) || "(vazio)"}
${s.decisoes && s.decisoes.length ? `\nDECISÕES REGISTRADAS:\n${s.decisoes.map((d) => "- " + d).join("\n")}\n` : ""}${pendentes.length ? `\nAÇÕES JÁ DELEGADAS (inclua-as no checklist, sem duplicar):\n${pendentes.map((t) => `- ${t.text}${t.userName ? ` — ${t.userName}` : ""}${t.date ? ` — prazo ${t.date}` : ""}`).join("\n")}\n` : ""}${transcricao ? `\nTRANSCRIÇÃO DA REUNIÃO (use para achar combinados que não foram anotados):\n${transcricao}\n` : ""}
Monte o checklist do que a equipe precisa REALIZAR nesta semana, a partir de tudo acima.
Regras:
- Cada item é uma ação concreta e verificável, começando com um verbo no infinitivo (ex.: "Retomar contato com a Alfa Incorporadora sobre a proposta revisada").
- Inclua o que ficou pendente, o que foi combinado e o que a reunião deixou claro que precisa acontecer; não invente nada que não esteja no material.
- Não repita a mesma ação em itens diferentes; junte o que for a mesma coisa.
- No máximo 15 itens, do mais urgente para o menos urgente.
- "responsavel": use o nome EXATO de alguém da equipe cadastrada quando estiver claro de quem é a tarefa; caso contrário, null.
- "prazo": DD/MM/AAAA quando houver data combinada ou dedutível ("até quinta"); caso contrário, null.
- "prioridade": "alta" quando houver risco, cobrança, prazo estourando ou dinheiro na mesa; senão "normal".
Responda SOMENTE com JSON válido, sem markdown e sem texto antes ou depois, neste formato:
{"itens":[{"tarefa":"...","responsavel":"nome exato ou null","prazo":"DD/MM/AAAA ou null","prioridade":"alta"}]}`;
}

/* Respostas de texto livre (resumo semanal, pergunte ao acervo) também
   viajam como JSON estrito para a fila funcionar de forma uniforme. */
export const TEXT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["texto"],
  properties: { texto: { type: "string" } },
};

const ATA_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["titulo", "data", "resumo", "participantes", "pauta", "decisoes", "comparativo", "acoes"],
  properties: {
    titulo: { type: "string" },
    data: { type: "string" },
    resumo: { type: "string" },
    participantes: { type: "array", items: { type: "string" } },
    pauta: { type: "array", items: { type: "string" } },
    decisoes: { type: "array", items: { type: "string" } },
    comparativo: { type: "array", items: { type: "string" } },
    acoes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tarefa", "responsavel", "prazo", "importante"],
        properties: {
          tarefa: { type: "string" },
          responsavel: { type: ["string", "null"] },
          prazo: { type: ["string", "null"] },
          importante: { type: "boolean" },
        },
      },
    },
  },
};

/* ---------- fila no OneDrive ---------- */
export async function enqueueRequest({ tipo, noteId, prompt }) {
  const id = uid();
  await ensureFolder("planner-ia-fila");
  await writeJsonFile(`${FILA}/pedido-${id}.json`, {
    id, tipo, noteId,
    criadoEm: new Date().toISOString(),
    formato: "json-estrito",
    prompt,
  });
  return id;
}

/* Tenta buscar a resposta de um pedido; devolve o JSON ou null. */
export async function pollResponse(id) {
  const resp = await readJsonFile(`${FILA}/resposta-${id}.json`);
  if (!resp) return null;
  let parsed = resp.resposta ?? resp.json ?? resp;
  if (typeof parsed === "string") {
    const m = parsed.match(/\{[\s\S]*\}/);
    parsed = m ? JSON.parse(m[0]) : JSON.parse(parsed);
  }
  deleteFile(`${FILA}/resposta-${id}.json`).catch(() => {});
  return parsed;
}

/* ---------- modo direto (chave própria, resposta em segundos) ---------- */
export async function callDirect(prompt, schema = ATA_SCHEMA) {
  const key = getAnthropicKey();
  if (!key) throw new Error("sem chave");
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 8000,
    output_config: { format: { type: "json_schema", schema } },
    messages: [{ role: "user", content: prompt }],
  });
  if (response.stop_reason === "refusal") throw new Error("A IA recusou o pedido — tente reformular.");
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return JSON.parse(text);
}
