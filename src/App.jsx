import React, { useEffect, useState } from "react";
import { BookOpen, LogIn, Loader2, KeyRound } from "lucide-react";
import { initAuth, login, getClientId, setClientId } from "./auth.js";
import Planner from "./Planner.jsx";

const Stamp = () => (
  <div className="inline-flex items-center gap-2 rounded-lg bg-stamp px-4 py-2 text-white shadow-sm">
    <BookOpen size={20} />
    <span className="font-title text-lg tracking-wide">Planner</span>
  </div>
);

export default function App() {
  const [phase, setPhase] = useState("carregando"); // carregando | sem-client-id | deslogado | logado
  const [clientIdInput, setClientIdInput] = useState("");

  useEffect(() => {
    initAuth()
      .then((r) => setPhase(r.status === "logado" ? "logado" : r.status))
      .catch(() => setPhase("sem-client-id"));
  }, []);

  if (phase === "logado") return <Planner />;

  const salvarClientId = () => {
    if (!clientIdInput.trim()) return;
    setClientId(clientIdInput);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-white/70 p-8 shadow-sm">
        <Stamp />
        <h1 className="font-title mt-5 text-3xl text-ink">Olá, Gui 👋</h1>
        <p className="mt-2 text-ink-soft/80">
          Planner — Gui · Finamob. Entre com sua conta Microsoft para abrir seus
          cadernos (os dados moram no seu OneDrive).
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
              (portal.azure.com → App registrations). É o mesmo código usado nos
              outros aparelhos.
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
      </div>
      <p className="mt-4 text-xs text-ink-soft/50">Sessão 2 · cadernos, editor e pendências</p>
    </div>
  );
}
