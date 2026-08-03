import { getToken } from "./auth.js";

const GRAPH = "https://graph.microsoft.com/v1.0";
const FILE_PATH = "/planner-dados.json"; // raiz do OneDrive

/* Último token válido, para o flush de emergência ao fechar a página
   (nesse momento não dá para esperar uma renovação assíncrona). */
let cachedToken = null;

async function graphFetch(url, options = {}) {
  const token = await getToken();
  cachedToken = token;
  const res = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  return res;
}

/* Lê o planner-dados.json da raiz do OneDrive. Retorna null se não existir. */
export async function readPlannerData() {
  const res = await graphFetch(`${GRAPH}/me/drive/root:${FILE_PATH}:/content`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Erro ao ler o OneDrive (HTTP ${res.status})`);
  return await res.json();
}

/* Grava o planner-dados.json na raiz do OneDrive. */
export async function writePlannerData(data) {
  const res = await graphFetch(`${GRAPH}/me/drive/root:${FILE_PATH}:/content`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Erro ao gravar no OneDrive (HTTP ${res.status})`);
  return await res.json();
}

/* ---------- arquivos genéricos (fila de IA em /planner-ia-fila) ---------- */

/* Lê um JSON em qualquer caminho do OneDrive. Retorna null se não existir. */
export async function readJsonFile(path) {
  const res = await graphFetch(`${GRAPH}/me/drive/root:${path}:/content`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Erro ao ler ${path} (HTTP ${res.status})`);
  return await res.json();
}

/* Grava um JSON em qualquer caminho do OneDrive (cria a pasta se preciso). */
export async function writeJsonFile(path, data) {
  const res = await graphFetch(`${GRAPH}/me/drive/root:${path}:/content`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Erro ao gravar ${path} (HTTP ${res.status})`);
  return await res.json();
}

/* Envia um arquivo binário (imagem) para o OneDrive. */
export async function uploadBinaryFile(path, blob, contentType) {
  const res = await graphFetch(`${GRAPH}/me/drive/root:${path}:/content`, {
    method: "PUT",
    headers: { "Content-Type": contentType || "application/octet-stream" },
    body: blob,
  });
  if (!res.ok) throw new Error(`Erro ao enviar ${path} (HTTP ${res.status})`);
  return await res.json();
}

/* Envia arquivos maiores que 4MB em pedaços (sessão de upload do Graph). */
export async function uploadLargeFile(path, blob) {
  const sess = await graphFetch(`${GRAPH}/me/drive/root:${path}:/createUploadSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "replace" } }),
  });
  if (!sess.ok) throw new Error(`Erro ao iniciar envio de ${path} (HTTP ${sess.status})`);
  const { uploadUrl } = await sess.json();
  const CHUNK = 320 * 1024 * 16; // 5MB, múltiplo de 320KB como o Graph exige
  let pos = 0;
  let item = null;
  while (pos < blob.size) {
    const end = Math.min(pos + CHUNK, blob.size);
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Range": `bytes ${pos}-${end - 1}/${blob.size}` },
      body: blob.slice(pos, end),
    });
    if (!res.ok) throw new Error(`Erro no envio de ${path} (HTTP ${res.status})`);
    if (res.status === 200 || res.status === 201) item = await res.json();
    pos = end;
  }
  return item;
}

/* Link temporário de download direto (pré-autenticado) de um arquivo. */
export async function getDownloadUrl(path) {
  const res = await graphFetch(`${GRAPH}/me/drive/root:${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Erro ao localizar ${path} (HTTP ${res.status})`);
  const item = await res.json();
  return item["@microsoft.graph.downloadUrl"] || null;
}

/* Baixa um arquivo binário e devolve uma URL local para usar em <img>.
   Retorna null se não existir. */
export async function readFileAsObjectUrl(path) {
  const res = await graphFetch(`${GRAPH}/me/drive/root:${path}:/content`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Erro ao ler ${path} (HTTP ${res.status})`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function deleteFile(path) {
  const res = await graphFetch(`${GRAPH}/me/drive/root:${path}:`, { method: "DELETE" });
  return res.ok || res.status === 404;
}

/* Garante que uma pasta exista na raiz do OneDrive (409 = já existe, ok). */
export async function ensureFolder(name) {
  const res = await graphFetch(`${GRAPH}/me/drive/root/children`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, folder: {}, "@microsoft.graph.conflictBehavior": "fail" }),
  });
  return res.ok || res.status === 409;
}

/* Gravação de emergência (página fechando): melhor esforço, sem await. */
export function writePlannerDataKeepalive(data) {
  if (!cachedToken) return;
  try {
    fetch(`${GRAPH}/me/drive/root:${FILE_PATH}:/content`, {
      method: "PUT",
      keepalive: true,
      headers: { Authorization: `Bearer ${cachedToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (e) { /* melhor esforço */ }
}
