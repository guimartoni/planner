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

export const getAnthropicKey = () => localStorage.getItem(KEY_STORAGE) || "";
export const setAnthropicKey = (k) => {
  if (k && k.trim()) localStorage.setItem(KEY_STORAGE, k.trim());
  else localStorage.removeItem(KEY_STORAGE);
};

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
