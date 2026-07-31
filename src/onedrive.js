import { getToken } from "./auth.js";

const GRAPH = "https://graph.microsoft.com/v1.0";
const FILE_PATH = "/planner-dados.json"; // raiz do OneDrive

async function graphFetch(url, options = {}) {
  const token = await getToken();
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
  return await res.json(); // metadados do arquivo (id, lastModified, etc.)
}
