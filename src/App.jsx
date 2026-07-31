import React, { useEffect, useState } from "react";
import { BookOpen, LogIn, LogOut, Cloud, Check, Loader2, KeyRound } from "lucide-react";
import { initAuth, login, logout, getClientId, setClientId } from "./auth.js";
import { readPlannerData, writePlannerData } from "./onedrive.js";

const Stamp = () => (
  <div className="inline-flex items-center gap-2 rounded-lg bg-stamp px-4 py-2 text-white shadow-sm">
    <BookOpen size={20} />
    <span className="font-title text-lg tracking-wide">Planner</span>
  </div>
);

export default function App() {
  const [phase, setPhase] = useState("carregando"); // carregando | sem-client-id | deslogado | logado
  const [account, setAccount] = useState(null);
  const [clientIdInput, setClientIdInput] = useState("");
  const [teste, setTeste] = useState(null); // {status: 'rodando'|'ok'|'erro', msg}

  useEffect(() => {
    initAuth()
      .then((r) => {
        setPhase(r.status === "logado" ? "logado" : r.status);
        if (r.account) setAccount(r.account);
      })
      .catch((e) => setPhase("sem-client-id"));
  }, []);

  const salvarClientId = () => {
    if (!clientIdInput.trim()) return;
    setClientId(clientIdInput);
    window.location.reload();
  };

  const testarOneDrive = async () => {
    setTeste({ status: "rodando", msg: "Lendo planner-dados.json no seu OneDrive…" });
    try {
      let dados = await readPlannerData();
      if (dados === null) {
        setTeste({ status: "rodando", msg: "Arquivo ainda não existe — criando…" });
        dados = { meta: null, bodies: {}, tmbKey: "", _criadoEm: new Date().toISOString() };
      }
      dados._ultimoTeste = new Date().toISOString();
      await writePlannerData(dados);
      const relido = await readPlannerData();
      const tam = JSON.stringify(relido).length;
      setTeste({
        status: "ok",
        msg: `Gravou e leu do OneDrive ✓ (planner-dados.json, ${tam.toLocaleString("pt-BR")} caracteres)`,
      });
    } catch (e) {
      setTeste({ status: "erro", msg: e.message || "Erro desconhecido" });
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-white/70 p-8 shadow-sm">
        <Stamp />
        <h1 className="font-title mt-5 text-3xl text-ink">Olá, Gui 👋</h1>
        <p className="mt-2 text-ink-soft/80">
          Este é o novo Planner — Gui · Finamob, agora com endereço próprio na web.
          Sessão 1: fundação (deploy + login Microsoft + OneDrive).
        </p>

        {phase === "carregando" && (
          <p className="mt-6 flex items-center gap-2 text-ink-soft/70">
            <Loader2 className="animate-spin" size={18} /> Carregando…
          </p>
        )}

        {phase === "sem-client-id" && (
          <div className="mt-6 rounded-xl bg-stamp-soft p-4">
            <p className="flex items-center gap-2 font-medium text-stamp">
              <KeyRound size={18} /> Falta conectar sua conta Microsoft
            </p>
            <p className="mt-2 text-sm text-ink-soft/80">
              Cole aqui o <b>Client ID</b> do registro do app no Azure
              (portal.azure.com → App registrations). O passo a passo está no
              guia da Sessão 1.
            </p>
            <input
              value={clientIdInput}
              onChange={(e) => setClientIdInput(e.target.value)}
              placeholder="ex.: 1a2b3c4d-…"
              className="mt-3 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-stamp"
            />
            <button
              onClick={salvarClientId}
              className="mt-3 rounded-lg bg-stamp px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Salvar e continuar
            </button>
          </div>
        )}

        {phase === "deslogado" && (
          <button
            onClick={login}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-stamp px-5 py-2.5 font-medium text-white hover:opacity-90"
          >
            <LogIn size={18} /> Entrar com a conta Microsoft
          </button>
        )}

        {phase === "logado" && (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-ink-soft/80">
              Conectado como <b>{account?.name || account?.username}</b>
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={testarOneDrive}
                disabled={teste?.status === "rodando"}
                className="inline-flex items-center gap-2 rounded-lg bg-stamp px-5 py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                <Cloud size={18} /> Testar OneDrive
              </button>
              <button
                onClick={logout}
                className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm text-ink-soft hover:bg-stamp-soft"
              >
                <LogOut size={16} /> Sair
              </button>
            </div>
            {teste && (
              <p
                className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
                  teste.status === "ok"
                    ? "bg-stamp-soft text-stamp"
                    : teste.status === "erro"
                      ? "bg-red-50 text-red-700"
                      : "bg-stamp-soft/50 text-ink-soft"
                }`}
              >
                {teste.status === "rodando" && <Loader2 className="mt-0.5 shrink-0 animate-spin" size={16} />}
                {teste.status === "ok" && <Check className="mt-0.5 shrink-0" size={16} />}
                <span>{teste.msg}</span>
              </p>
            )}
          </div>
        )}
      </div>
      <p className="mt-4 text-xs text-ink-soft/50">Sessão 1 · build inicial</p>
    </div>
  );
}
