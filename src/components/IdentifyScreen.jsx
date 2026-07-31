import { useState } from "react";
import { BookOpen, UserCircle2 } from "lucide-react";
import { C } from "../lib/util.js";
import Avatar from "./Avatar.jsx";

export default function IdentifyScreen({ users, onPick, onCreate }) {
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  return (
    <div className="h-screen flex items-center justify-center p-4" style={{ background: C.ink }}>
      <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: "#fff" }}>
        <div className="flex items-center gap-2 mb-1">
          <BookOpen size={20} color={C.stamp} />
          <h1 className="text-lg font-bold" style={{ fontFamily: "Georgia, serif", color: "#1F2937" }}>Planner - Gui - Finamob</h1>
        </div>
        <p className="text-xs mb-4" style={{ color: "#6B7280" }}>
          Quem é você? As atas, tarefas e cadastros são compartilhados entre quem acessa este Planner.
        </p>
        {users.length > 0 && (
          <div className="flex flex-col gap-1.5 mb-4 max-h-48 overflow-y-auto">
            {users.map((u) => (
              <button key={u.id} onClick={() => onPick(u)}
                className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm text-left hover:bg-gray-50"
                style={{ borderColor: C.line }}>
                <Avatar user={u} />
                <span className="flex-1 font-medium" style={{ color: "#1F2937" }}>{u.name}</span>
                <span className="text-xs" style={{ color: "#9CA3AF" }}>{u.area}</span>
              </button>
            ))}
          </div>
        )}
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#6B7280" }}>
          {users.length > 0 ? "Ou cadastre-se" : "Cadastre-se para começar"}
        </p>
        <div className="flex flex-col gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome completo"
            className="border rounded-lg px-3 py-2.5 text-sm outline-none" style={{ borderColor: C.line }} />
          <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Sua área (ex.: Comercial)"
            className="border rounded-lg px-3 py-2.5 text-sm outline-none" style={{ borderColor: C.line }} />
          <button
            onClick={() => { if (name.trim()) onCreate(name.trim(), area.trim()); }}
            className="rounded-lg py-2.5 text-sm font-semibold text-white flex items-center justify-center gap-2"
            style={{ background: C.stamp }}>
            <UserCircle2 size={16} /> Entrar
          </button>
        </div>
      </div>
    </div>
  );
}
