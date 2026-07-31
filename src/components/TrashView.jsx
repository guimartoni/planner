import { useState } from "react";
import { Trash2 } from "lucide-react";
import { C } from "../lib/util.js";

export default function TrashView({ meta, onRestore, onPurge, onEmpty }) {
  const trash = meta.trash || [];
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  return (
    <div className="max-w-3xl mx-auto px-4 py-5">
      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-xl font-semibold flex-1" style={{ color: "#1F2937", fontFamily: "Georgia, serif" }}>Lixeira</h1>
        {trash.length > 0 && (
          confirmEmpty ? (
            <button onClick={() => { onEmpty(); setConfirmEmpty(false); }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: C.danger }}>
              Confirmar exclusão de tudo
            </button>
          ) : (
            <button onClick={() => setConfirmEmpty(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "#FBE9E7", color: C.danger }}>
              Esvaziar lixeira
            </button>
          )
        )}
      </div>
      <p className="text-xs mb-4" style={{ color: "#9CA3AF" }}>Páginas descartadas ficam guardadas aqui até serem restauradas ou excluídas definitivamente.</p>
      {trash.length === 0 && <p className="text-sm" style={{ color: "#6B7280" }}>A lixeira está vazia.</p>}
      <div className="flex flex-col gap-1.5">
        {trash.map((t) => (
          <div key={t.id} className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm" style={{ borderColor: C.line, background: "#fff" }}>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate" style={{ color: "#1F2937" }}>{t.title || "Página sem nome"}</p>
              <p className="text-xs" style={{ color: "#9CA3AF" }}>{t.nbName} · {t.secName} · excluída em {t.deletedAt}</p>
            </div>
            <button onClick={() => onRestore(t.id)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium" style={{ background: C.stampSoft, color: C.stamp }}>
              Restaurar
            </button>
            <button onClick={() => onPurge(t.id)} className="p-1.5" style={{ color: C.danger }} title="Excluir definitivamente">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
