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
